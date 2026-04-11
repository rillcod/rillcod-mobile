/// <reference path="../deno-ambient.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

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

    let body: { invoice_id?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const invoiceId = body.invoice_id?.trim();
    if (!invoiceId) {
      return json({ error: 'invoice_id is required' }, 400);
    }

    const { data: profile, error: profErr } = await admin
      .from('portal_users')
      .select('role, school_id')
      .eq('id', userId)
      .maybeSingle();

    if (profErr || !profile) {
      return json({ error: 'Profile not found' }, 403);
    }

    const { data: invoice, error: invErr } = await admin
      .from('invoices')
      .select('id, amount, currency, status, school_id, portal_user_id, invoice_number')
      .eq('id', invoiceId)
      .maybeSingle();

    if (invErr || !invoice) {
      return json({ error: 'Invoice not found' }, 404);
    }

    const role = profile.role as string;
    const payerId = invoice.portal_user_id;
    if (!payerId) {
      return json({ error: 'Invoice has no billed portal user' }, 400);
    }

    if (role === 'school') {
      if (!profile.school_id || invoice.school_id !== profile.school_id) {
        return json({ error: 'Forbidden' }, 403);
      }
    } else if (role === 'admin') {
      // full access
    } else if (role === 'parent') {
      const { data: stu } = await admin
        .from('students')
        .select('parent_email')
        .eq('user_id', payerId)
        .maybeSingle();
      const { data: selfPu } = await admin.from('portal_users').select('email').eq('id', userId).maybeSingle();
      const pe = stu?.parent_email?.trim().toLowerCase() ?? '';
      const ue = selfPu?.email?.trim().toLowerCase() ?? '';
      if (!pe || !ue || pe !== ue) {
        return json({ error: 'Forbidden' }, 403);
      }
    } else if (invoice.portal_user_id === userId) {
      // billed user (student / self-pay)
    } else {
      return json({ error: 'Forbidden' }, 403);
    }

    const st = (invoice.status || '').toLowerCase();
    if (st === 'paid' || st === 'cancelled') {
      return json({ error: 'Invoice is not payable in this state' }, 400);
    }

    let email: string | null = null;
    if (role === 'parent') {
      const { data: parentPu } = await admin.from('portal_users').select('email').eq('id', userId).maybeSingle();
      email = parentPu?.email?.trim() ?? null;
    }
    if (!email) {
      const { data: billedUser } = await admin.from('portal_users').select('email').eq('id', payerId).maybeSingle();
      email = billedUser?.email?.trim() ?? null;
    }
    if (!email) {
      return json({ error: 'Payer email is required for Paystack' }, 400);
    }

    const currency = (invoice.currency || 'NGN').toUpperCase();
    if (currency !== 'NGN') {
      return json({ error: 'Paystack checkout is only wired for NGN' }, 400);
    }

    const amountMinor = Math.round(Number(invoice.amount) * 100);
    if (!Number.isFinite(amountMinor) || amountMinor < 100) {
      return json({ error: 'Invalid invoice amount' }, 400);
    }

    const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!secret) {
      return json({ error: 'Paystack not configured' }, 500);
    }

    const reference = `inv_${invoiceId}_${Date.now()}`;

    const initPayload: Record<string, unknown> = {
      email,
      amount: amountMinor,
      reference,
      currency: 'NGN',
      metadata: {
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        school_id: invoice.school_id,
        initiated_by: userId,
      },
    };
    const explicitCallback = Deno.env.get('PAYSTACK_CALLBACK_URL')?.trim();
    const supabaseBase = supabaseUrl.replace(/\/$/, '');
    const mobileDefaultCallback = `${supabaseBase}/functions/v1/paystack-callback`;
    const callbackUrl = explicitCallback || mobileDefaultCallback;
    if (callbackUrl) {
      initPayload.callback_url = callbackUrl;
    }

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(initPayload),
    });

    const paystackJson = (await paystackRes.json()) as {
      status?: boolean;
      message?: string;
      data?: { authorization_url?: string; reference?: string; access_code?: string };
    };

    if (!paystackRes.ok || !paystackJson.status || !paystackJson.data?.authorization_url) {
      return json(
        {
          error: paystackJson.message || 'Paystack initialize failed',
        },
        502,
      );
    }

    return json({
      authorization_url: paystackJson.data.authorization_url,
      reference: paystackJson.data.reference ?? reference,
      access_code: paystackJson.data.access_code,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
