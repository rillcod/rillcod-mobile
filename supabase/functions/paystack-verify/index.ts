// @ts-nocheck
// Supabase Edge (Deno). VS Code uses Node typings; use `supabase functions serve` for real checks.
/**
 * Authenticated client calls after Paystack redirect / app resume to sync DB if webhook was delayed.
 * Verifies transaction with Paystack API, then runs same fulfillment as webhook (idempotent).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  fulfillPaystackSuccessfulPayment,
  resolveInvoiceIdFromPaystack,
} from '../paystackFulfillShared.ts';

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
    const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!supabaseUrl || !serviceKey || !paystackSecret) {
      return json({ error: 'Server misconfigured' }, 500);
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: authErr } = await admin.auth.getUser(jwt);
    if (authErr || !userData?.user) {
      return json({ error: 'Invalid session' }, 401);
    }
    const userId = userData.user.id;

    let body: { reference?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const reference = body.reference?.trim();
    if (!reference) {
      return json({ error: 'reference is required' }, 400);
    }

    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${paystackSecret}` },
    });
    const verifyJson = (await verifyRes.json()) as {
      status?: boolean;
      message?: string;
      data?: Record<string, unknown>;
    };

    if (!verifyRes.ok || !verifyJson.status || !verifyJson.data) {
      return json({ error: verifyJson.message || 'Paystack verify failed', fulfilled: false }, 200);
    }

    const d = verifyJson.data;
    if (String(d.status) !== 'success') {
      return json({ fulfilled: false, reason: 'payment not successful yet' }, 200);
    }

    const amountKobo = Number(d.amount);
    const metadata = (d.metadata && typeof d.metadata === 'object')
      ? (d.metadata as Record<string, unknown>)
      : {};

    const invoiceIdResolved = resolveInvoiceIdFromPaystack(reference, metadata);
    if (!invoiceIdResolved) {
      return json({ fulfilled: false, reason: 'could not resolve invoice from transaction' }, 200);
    }

    const { data: profile } = await admin
      .from('portal_users')
      .select('role, school_id')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) {
      return json({ error: 'Profile not found' }, 403);
    }

    const { data: invoice } = await admin
      .from('invoices')
      .select('id, school_id, portal_user_id')
      .eq('id', invoiceIdResolved)
      .maybeSingle();

    if (!invoice) {
      return json({ error: 'Invoice not found' }, 404);
    }

    const role = profile.role as string;
    const billedId = invoice.portal_user_id;
    if (role === 'school') {
      if (!profile.school_id || invoice.school_id !== profile.school_id) {
        return json({ error: 'Forbidden' }, 403);
      }
    } else if (role === 'admin') {
      // ok
    } else if (role === 'parent' && billedId) {
      const { data: stu } = await admin
        .from('students')
        .select('parent_email')
        .eq('user_id', billedId)
        .maybeSingle();
      const { data: selfPu } = await admin.from('portal_users').select('email').eq('id', userId).maybeSingle();
      const pe = stu?.parent_email?.trim().toLowerCase() ?? '';
      const ue = selfPu?.email?.trim().toLowerCase() ?? '';
      if (!pe || !ue || pe !== ue) {
        return json({ error: 'Forbidden' }, 403);
      }
    } else if (invoice.portal_user_id === userId) {
      // ok
    } else {
      return json({ error: 'Forbidden' }, 403);
    }

    const result = await fulfillPaystackSuccessfulPayment(admin, {
      reference,
      amountKobo,
      paystackTransactionId: String(d.id ?? d.transaction_id ?? ''),
      metadata,
      gatewayPayload: d,
    });

    if (!result.ok) {
      return json({ fulfilled: false, reason: result.reason }, 200);
    }

    return json({
      fulfilled: true,
      alreadyDone: result.alreadyDone,
      invoice_id: invoiceIdResolved,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
