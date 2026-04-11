// @ts-nocheck — Deno resolves https:// imports at runtime; Node/VS Code TS does not.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export type FulfillInput = {
  reference: string;
  amountKobo: number;
  paystackTransactionId: string | number;
  metadata: Record<string, unknown>;
  gatewayPayload: unknown;
};

type InvoiceRow = {
  id: string;
  amount: number;
  currency: string | null;
  status: string | null;
  school_id: string | null;
  portal_user_id: string | null;
  invoice_number: string;
  items: unknown;
  notes: string | null;
  payment_transaction_id: string | null;
};

function invoiceIdFromReference(reference: string): string | null {
  const m = /^inv_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_/i.exec(reference);
  return m ? m[1] : null;
}

function metaString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string' && v.trim()) return v.trim();
  return null;
}

/** Invoice id from Paystack metadata or from our reference format inv_<uuid>_<ts>. */
export function resolveInvoiceIdFromPaystack(
  reference: string,
  metadata: Record<string, unknown>,
): string | null {
  return metaString(metadata?.invoice_id) ?? invoiceIdFromReference(reference);
}

type ReceiptLine = { description: string; quantity: number; unit_price: number; total: number };

function buildReceiptLineItems(invoice: InvoiceRow): ReceiptLine[] {
  const raw = invoice.items;
  if (Array.isArray(raw)) {
    const lines: ReceiptLine[] = [];
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      const desc = typeof o.description === 'string' ? o.description : 'Line item';
      const qty = typeof o.quantity === 'number' && o.quantity > 0 ? o.quantity : 1;
      const total = typeof o.total === 'number' ? o.total : typeof o.amount === 'number' ? o.amount : Number(invoice.amount);
      const unit = typeof o.unit_price === 'number' ? o.unit_price : total / qty;
      lines.push({ description: desc, quantity: qty, unit_price: unit, total });
    }
    if (lines.length) return lines;
  }
  const label = invoice.invoice_number?.trim() || invoice.id;
  return [
    {
      description: `Invoice ${label}`,
      quantity: 1,
      unit_price: Number(invoice.amount),
      total: Number(invoice.amount),
    },
  ];
}

/** One receipt per payment_transaction; safe to call on every idempotent fulfillment path. */
export async function ensurePaystackReceipt(
  admin: SupabaseClient,
  transactionId: string,
  invoice: InvoiceRow,
  paystackReference: string,
): Promise<void> {
  const { data: existing } = await admin
    .from('receipts')
    .select('id')
    .eq('transaction_id', transactionId)
    .maybeSingle();

  if (existing) return;

  const now = new Date().toISOString();
  const receiptNumber = `RCPT-${Date.now().toString(36).toUpperCase()}-PS`;
  const lineItems = buildReceiptLineItems(invoice);
  const payerType = invoice.portal_user_id ? 'student' : invoice.school_id ? 'school' : 'student';

  const { error } = await admin.from('receipts').insert({
    receipt_number: receiptNumber,
    amount: Number(invoice.amount),
    currency: (invoice.currency || 'NGN').toUpperCase(),
    school_id: invoice.school_id,
    student_id: invoice.portal_user_id,
    transaction_id: transactionId,
    issued_at: now,
    metadata: {
      payer_type: payerType,
      payment_method: 'paystack',
      payment_date: now.split('T')[0],
      reference: paystackReference,
      received_by: 'Paystack (automatic)',
      notes: invoice.notes ?? null,
      items: lineItems,
      source: 'paystack',
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
    },
  });

  if (error) {
    console.error('ensurePaystackReceipt insert failed', error.message);
  }
}

export async function fulfillPaystackSuccessfulPayment(
  admin: SupabaseClient,
  input: FulfillInput,
): Promise<{ ok: boolean; reason?: string; alreadyDone?: boolean }> {
  const invoiceId = resolveInvoiceIdFromPaystack(input.reference, input.metadata);
  if (!invoiceId) {
    return { ok: false, reason: 'missing invoice_id (metadata and reference parse failed)' };
  }

  const now = new Date().toISOString();

  const { data: invoice, error: invErr } = await admin
    .from('invoices')
    .select(
      'id, amount, currency, status, school_id, portal_user_id, invoice_number, items, notes, payment_transaction_id',
    )
    .eq('id', invoiceId)
    .maybeSingle();

  if (invErr || !invoice) return { ok: false, reason: 'invoice not found' };

  const inv = invoice as InvoiceRow;

  const expectedKobo = Math.round(Number(inv.amount) * 100);
  if (!Number.isFinite(expectedKobo) || input.amountKobo !== expectedKobo) {
    return { ok: false, reason: 'amount mismatch' };
  }

  const { data: existingTx } = await admin
    .from('payment_transactions')
    .select('id, payment_status')
    .eq('transaction_reference', input.reference)
    .maybeSingle();

  if (existingTx?.payment_status === 'completed') {
    await admin
      .from('invoices')
      .update({ status: 'paid', payment_transaction_id: existingTx.id, updated_at: now })
      .eq('id', invoiceId);
    await ensurePaystackReceipt(admin, existingTx.id as string, inv, input.reference);
    return { ok: true, alreadyDone: true };
  }

  if ((inv.status || '').toLowerCase() === 'paid') {
    if (inv.payment_transaction_id) {
      await ensurePaystackReceipt(admin, inv.payment_transaction_id, inv, input.reference);
    }
    return { ok: true, alreadyDone: true };
  }

  const { data: inserted, error: insErr } = await admin
    .from('payment_transactions')
    .insert({
      amount: input.amountKobo / 100,
      currency: (inv.currency || 'NGN').toUpperCase(),
      external_transaction_id: String(input.paystackTransactionId),
      invoice_id: invoiceId,
      paid_at: now,
      payment_gateway_response: input.gatewayPayload as Record<string, unknown>,
      payment_method: 'paystack',
      payment_status: 'completed',
      portal_user_id: inv.portal_user_id,
      school_id: inv.school_id,
      transaction_reference: input.reference,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (insErr) {
    if (insErr.code === '23505') {
      const { data: tx2 } = await admin
        .from('payment_transactions')
        .select('id')
        .eq('transaction_reference', input.reference)
        .maybeSingle();
      if (tx2?.id) {
        await admin
          .from('invoices')
          .update({ status: 'paid', payment_transaction_id: tx2.id, updated_at: now })
          .eq('id', invoiceId);
        await ensurePaystackReceipt(admin, tx2.id as string, inv, input.reference);
        return { ok: true, alreadyDone: true };
      }
    }
    return { ok: false, reason: insErr.message };
  }

  const txId = inserted.id as string;
  const { error: updErr } = await admin
    .from('invoices')
    .update({ status: 'paid', payment_transaction_id: txId, updated_at: now })
    .eq('id', invoiceId);

  if (updErr) return { ok: false, reason: updErr.message };

  await ensurePaystackReceipt(admin, txId, inv, input.reference);

  return { ok: true };
}
