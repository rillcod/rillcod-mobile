// @ts-nocheck
/**
 * After the client uploads proof to R2, call this with the public URL.
 * Verifies the caller may pay the invoice, records `invoice_payment_proofs`,
 * creates a `payment_transactions` row (processing) + matching `receipts` row for finance.
 * Does not mark the invoice paid — staff completes the transaction when verified.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { ensureBankTransferProofReceipt } from '../paystackFulfillShared.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

async function canUserAccessInvoice(
  admin: ReturnType<typeof createClient>,
  userId: string,
  invoicePortalUserId: string | null,
): Promise<boolean> {
  if (invoicePortalUserId && invoicePortalUserId === userId) return true;

  const { data: me, error: meErr } = await admin.from('portal_users').select('role, email').eq('id', userId).maybeSingle();
  if (meErr || !me || me.role !== 'parent' || !me.email) return false;

  const email = String(me.email).trim().toLowerCase();
  const { data: studs, error: sErr } = await admin.from('students').select('user_id').eq('parent_email', email);
  if (sErr || !studs?.length) return false;

  for (const s of studs) {
    if (s.user_id && s.user_id === invoicePortalUserId) return true;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing authorization' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return json({ error: 'Server misconfigured' }, 500);
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: authErr } = await admin.auth.getUser(jwt);
    if (authErr || !userData?.user) {
      return json({ error: 'Invalid session' }, 401);
    }
    const userId = userData.user.id;

    let body: { invoice_id?: string; proof_image_url?: string; payer_note?: string | null };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const invoiceId = body.invoice_id?.trim();
    const proofImageUrl = body.proof_image_url?.trim();
    if (!invoiceId || !proofImageUrl) {
      return json({ error: 'invoice_id and proof_image_url are required' }, 400);
    }
    if (!proofImageUrl.startsWith('http://') && !proofImageUrl.startsWith('https://')) {
      return json({ error: 'proof_image_url must be an http(s) URL' }, 400);
    }

    const { data: invoice, error: invErr } = await admin
      .from('invoices')
      .select(
        'id, amount, currency, status, school_id, portal_user_id, invoice_number, items, notes, payment_transaction_id, metadata',
      )
      .eq('id', invoiceId)
      .maybeSingle();

    if (invErr || !invoice) {
      return json({ error: 'Invoice not found' }, 404);
    }

    const inv = invoice as InvoiceRow;
    const st = (inv.status || '').toLowerCase();
    if (st === 'paid' || st === 'cancelled') {
      return json({ error: 'Invoice is not open for bank proof' }, 400);
    }

    const allowed = await canUserAccessInvoice(admin, userId, inv.portal_user_id);
    if (!allowed) {
      return json({ error: 'Not allowed to submit proof for this invoice' }, 403);
    }

    const { data: dup } = await admin
      .from('invoice_payment_proofs')
      .select('id')
      .eq('invoice_id', invoiceId)
      .eq('proof_image_url', proofImageUrl)
      .gte('created_at', new Date(Date.now() - 120_000).toISOString())
      .maybeSingle();

    if (dup) {
      return json({ ok: true, duplicate: true, message: 'Same proof was already submitted recently.' }, 200);
    }

    const { error: proofErr } = await admin.from('invoice_payment_proofs').insert({
      invoice_id: invoiceId,
      submitted_by: userId,
      proof_image_url: proofImageUrl,
      payer_note: body.payer_note?.trim() || null,
    });

    if (proofErr) {
      console.error('invoice_payment_proofs insert', proofErr);
      return json({ error: proofErr.message || 'Could not save proof' }, 500);
    }

    const now = new Date().toISOString();
    const txRef = `BANK-${invoiceId.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`;

    const { data: inserted, error: txErr } = await admin
      .from('payment_transactions')
      .insert({
        amount: Number(inv.amount),
        currency: (inv.currency || 'NGN').toUpperCase(),
        external_transaction_id: null,
        invoice_id: invoiceId,
        paid_at: null,
        payment_gateway_response: {
          proof_image_url: proofImageUrl,
          payer_note: body.payer_note?.trim() || null,
          submitted_via: 'bank_transfer_submit_proof',
        },
        payment_method: 'bank_transfer',
        payment_status: 'processing',
        portal_user_id: inv.portal_user_id,
        school_id: inv.school_id,
        transaction_reference: txRef,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (txErr) {
      console.error('payment_transactions insert', txErr);
      return json({ error: txErr.message || 'Could not create ledger row' }, 500);
    }

    const txId = inserted.id as string;
    await ensureBankTransferProofReceipt(admin, txId, inv, proofImageUrl, body.payer_note?.trim() ?? null);

    return json({
      ok: true,
      transaction_id: txId,
      transaction_reference: txRef,
    });
  } catch (e) {
    console.error('bank-transfer-submit-proof', e);
    return json({ error: (e as Error).message }, 500);
  }
});
