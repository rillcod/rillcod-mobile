// @ts-nocheck — Deno resolves https:// imports at runtime; Node/VS Code TS does not.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export type FulfillInput = {
  reference: string;
  amountKobo: number;
  paystackTransactionId: string | number;
  metadata: Record<string, unknown>;
  gatewayPayload: unknown;
};

/** Some Paystack / plugin setups nest custom metadata under `customer`, `authorization`, or `plan`. */
export function mergePaystackChargeMetadata(
  data: Record<string, unknown>,
  metadataFromTop: Record<string, unknown>,
): Record<string, unknown> {
  let nested: Record<string, unknown> = {};
  for (const key of ['customer', 'authorization', 'plan'] as const) {
    const part = data[key];
    if (part && typeof part === 'object' && !Array.isArray(part)) {
      const m = (part as Record<string, unknown>).metadata;
      if (m && typeof m === 'object' && !Array.isArray(m)) {
        nested = { ...nested, ...(m as Record<string, unknown>) };
      }
    }
  }
  return { ...nested, ...metadataFromTop };
}

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
  metadata: unknown;
};

function invoiceIdFromReference(reference: string): string | null {
  const m = /^inv_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_/i.exec(reference);
  return m ? m[1] : null;
}

function metaString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

/** Paystack may return flat keys, custom_fields[], or stringified JSON depending on product / dashboard. */
function extractInvoiceIdFromMetadata(metadata: Record<string, unknown>): string | null {
  const direct = metaString(metadata?.invoice_id);
  if (direct) return direct;
  const alt = metaString(metadata?.invoiceId);
  if (alt) return alt;

  const cf = metadata?.custom_fields;
  if (Array.isArray(cf)) {
    for (const item of cf) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const vn = String(o.variable_name ?? o.display_name ?? '').toLowerCase().replace(/\s+/g, '_');
      const vv = metaString(o.value);
      if (vv && (vn === 'invoice_id' || vn === 'invoiceid')) return vv;
    }
  }

  const nested = metadata?.metadata;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const inner = extractInvoiceIdFromMetadata(nested as Record<string, unknown>);
    if (inner) return inner;
  }

  return null;
}

/** Invoice id from Paystack metadata or from our reference format inv_<uuid>_<ts>. */
export function resolveInvoiceIdFromPaystack(
  reference: string,
  metadata: Record<string, unknown>,
): string | null {
  return extractInvoiceIdFromMetadata(metadata) ?? invoiceIdFromReference(reference);
}

/** After webhook / dashboard changes, Paystack may omit `invoice_id` but still send public-registration keys (or only custom_fields). */
function extractPublicRegistrationStudentFromMetadata(metadata: Record<string, unknown>): {
  studentId: string;
  source: string;
} | null {
  let sid = metaString(metadata?.student_registration_id);
  let src = metaString(metadata?.source);
  if (sid && src === 'public_registration') return { studentId: sid, source: src };

  const cf = metadata?.custom_fields;
  if (Array.isArray(cf)) {
    const map: Record<string, string> = {};
    for (const item of cf) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const vn = String(o.variable_name ?? o.display_name ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
      const vv = metaString(o.value);
      if (vn && vv) map[vn] = vv;
    }
    sid = sid || map['student_registration_id'] || map['studentregistrationid'];
    src = src || map['source'];
  }

  const nested = metadata?.metadata;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const inner = extractPublicRegistrationStudentFromMetadata(nested as Record<string, unknown>);
    if (inner) return inner;
  }

  if (sid && src === 'public_registration') return { studentId: sid, source: src };
  return null;
}

/** Latest invoice created by `paystack-initialize-public-registration` for this interest row. */
async function findPublicRegistrationInvoiceIdByStudentId(
  admin: SupabaseClient,
  studentId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('invoices')
    .select('id, metadata, created_at')
    .in('status', ['sent', 'overdue', 'paid'])
    .order('created_at', { ascending: false })
    .limit(120);

  if (error || !data?.length) return null;

  for (const row of data) {
    const m =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null;
    const sid = metaString(m?.student_registration_id);
    const src = metaString(m?.source);
    if (sid === studentId && src === 'public_registration') return String(row.id);
  }
  return null;
}

export async function resolveInvoiceIdForFulfillment(
  admin: SupabaseClient,
  reference: string,
  metadata: Record<string, unknown>,
): Promise<string | null> {
  let invoiceId = resolveInvoiceIdFromPaystack(reference, metadata);
  if (invoiceId) return invoiceId;

  const pub = extractPublicRegistrationStudentFromMetadata(metadata);
  if (pub?.studentId && pub.source === 'public_registration') {
    invoiceId = await findPublicRegistrationInvoiceIdByStudentId(admin, pub.studentId);
  }
  /** Webhook payloads sometimes drop `source` but still send `student_registration_id` (invoice rows are tagged). */
  if (!invoiceId) {
    const sidOnly = metaString(metadata?.student_registration_id);
    if (sidOnly) {
      invoiceId = await findPublicRegistrationInvoiceIdByStudentId(admin, sidOnly);
    }
  }
  return invoiceId;
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

/**
 * Ledger receipt for a bank-transfer proof (pending finance verification).
 * Invoice stays unpaid until staff marks the linked `payment_transactions` row completed.
 */
export async function ensureBankTransferProofReceipt(
  admin: SupabaseClient,
  transactionId: string,
  invoice: InvoiceRow,
  proofImageUrl: string,
  payerNote: string | null,
): Promise<void> {
  const { data: existing } = await admin
    .from('receipts')
    .select('id')
    .eq('transaction_id', transactionId)
    .maybeSingle();

  if (existing) return;

  const now = new Date().toISOString();
  const receiptNumber = `RCPT-${Date.now().toString(36).toUpperCase()}-BT`;
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
    pdf_url: null,
    metadata: {
      payer_type: payerType,
      payment_method: 'bank_transfer',
      payment_date: now.split('T')[0],
      reference: proofImageUrl.length > 120 ? proofImageUrl.slice(0, 120) + '…' : proofImageUrl,
      received_by: 'Pending verification',
      notes: payerNote ?? invoice.notes ?? null,
      items: lineItems,
      source: 'bank_transfer_proof',
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      proof_image_url: proofImageUrl,
      verification_status: 'submitted',
    },
  });

  if (error) {
    console.error('ensureBankTransferProofReceipt insert failed', error.message);
  }
}

/** When a public registration fee invoice is paid, stamp the pending `students` interest row. */
async function syncPublicRegistrationStudentFromInvoice(
  admin: SupabaseClient,
  invoice: Pick<InvoiceRow, 'metadata'>,
  paystackReference: string,
): Promise<void> {
  const meta =
    invoice.metadata && typeof invoice.metadata === 'object' && !Array.isArray(invoice.metadata)
      ? (invoice.metadata as Record<string, unknown>)
      : null;
  const sid = metaString(meta?.student_registration_id);
  const src = metaString(meta?.source);
  if (!sid || src !== 'public_registration') return;

  const { error } = await admin
    .from('students')
    .update({
      registration_payment_at: new Date().toISOString(),
      registration_paystack_reference: paystackReference,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sid)
    .eq('status', 'pending');

  if (error) {
    console.error('syncPublicRegistrationStudentFromInvoice failed', error.message);
  }
}

export async function fulfillPaystackSuccessfulPayment(
  admin: SupabaseClient,
  input: FulfillInput,
): Promise<{ ok: boolean; reason?: string; alreadyDone?: boolean }> {
  const invoiceId = await resolveInvoiceIdForFulfillment(admin, input.reference, input.metadata);
  if (!invoiceId) {
    return {
      ok: false,
      reason: 'missing invoice_id (reference parse, metadata, and public_registration invoice lookup failed)',
    };
  }

  const now = new Date().toISOString();

  const { data: invoice, error: invErr } = await admin
    .from('invoices')
    .select(
      'id, amount, currency, status, school_id, portal_user_id, invoice_number, items, notes, payment_transaction_id, metadata',
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
    await syncPublicRegistrationStudentFromInvoice(admin, inv, input.reference);
    return { ok: true, alreadyDone: true };
  }

  if ((inv.status || '').toLowerCase() === 'paid') {
    if (inv.payment_transaction_id) {
      await ensurePaystackReceipt(admin, inv.payment_transaction_id, inv, input.reference);
    }
    await syncPublicRegistrationStudentFromInvoice(admin, inv, input.reference);
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
        await syncPublicRegistrationStudentFromInvoice(admin, inv, input.reference);
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
  await syncPublicRegistrationStudentFromInvoice(admin, inv, input.reference);

  return { ok: true };
}
