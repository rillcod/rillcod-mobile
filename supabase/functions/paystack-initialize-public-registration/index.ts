/// <reference path="../deno-ambient.d.ts" />
// Public student interest → unpaid invoice → Paystack checkout (no Supabase auth).
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

function feeNgnForEnrollmentType(type: string | null | undefined): number {
  const t = String(type ?? '').toLowerCase();
  const env = (k: string, fallback: number) => {
    const v = Number(Deno.env.get(k));
    return Number.isFinite(v) && v >= 100 ? v : fallback;
  };
  switch (t) {
    case 'school':
      return env('PUBLIC_REG_FEE_SCHOOL_NGN', 17500);
    case 'bootcamp':
      return env('PUBLIC_REG_FEE_BOOTCAMP_NGN', 42500);
    case 'online':
      return env('PUBLIC_REG_FEE_ONLINE_NGN', 32500);
    case 'in_person':
      return env('PUBLIC_REG_FEE_IN_PERSON_NGN', 50000);
    default:
      return env('PUBLIC_REG_FEE_DEFAULT_NGN', 25000);
  }
}

function normalizeEmail(v: string | null | undefined): string {
  return String(v ?? '').trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!supabaseUrl || !serviceKey || !secret) {
      return json({ error: 'Server misconfigured' }, 500);
    }

    let body: { student_interest_id?: string; payer_email?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const studentId = body.student_interest_id?.trim();
    const payerEmail = normalizeEmail(body.payer_email);
    if (!studentId || !payerEmail) {
      return json({ error: 'student_interest_id and payer_email are required' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: stu, error: stErr } = await admin
      .from('students')
      .select('id, name, full_name, status, parent_email, student_email, enrollment_type, is_deleted, registration_payment_at')
      .eq('id', studentId)
      .maybeSingle();

    if (stErr || !stu) {
      return json({ error: 'Registration not found' }, 404);
    }

    if (stu.is_deleted === true) {
      return json({ error: 'This registration is no longer valid' }, 400);
    }

    if (stu.registration_payment_at) {
      return json({ error: 'Registration fee was already recorded for this application' }, 400);
    }

    if (String(stu.status ?? '').toLowerCase() !== 'pending') {
      return json({ error: 'This registration is not awaiting payment' }, 400);
    }

    let pe = normalizeEmail(stu.parent_email);
    let se = normalizeEmail(stu.student_email);
    if (!pe && !se) {
      const { error: patchErr } = await admin
        .from('students')
        .update({
          parent_email: payerEmail,
          student_email: payerEmail,
          updated_at: new Date().toISOString(),
        })
        .eq('id', studentId);
      if (patchErr) {
        return json({ error: patchErr.message || 'Could not attach payer email to this registration' }, 500);
      }
      pe = payerEmail;
      se = payerEmail;
    } else if (payerEmail !== pe && payerEmail !== se) {
      return json(
        {
          error:
            'Email does not match this registration. Pay with the same address you used on the form, or contact support to update it.',
        },
        403,
      );
    }

    const feeNgn = feeNgnForEnrollmentType(stu.enrollment_type);
    const amountMinor = Math.round(feeNgn * 100);
    if (amountMinor < 100) {
      return json({ error: 'Invalid fee configuration' }, 500);
    }

    const { data: candidates, error: listErr } = await admin
      .from('invoices')
      .select('id, amount, status, metadata, created_at')
      .in('status', ['sent', 'overdue'])
      .order('created_at', { ascending: false })
      .limit(80);

    if (listErr) {
      return json({ error: listErr.message }, 500);
    }

    let invoiceId: string | null = null;
    const rows = candidates ?? [];
    for (const r of rows) {
      const m = r.metadata && typeof r.metadata === 'object' && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : null;
      const sid = typeof m?.student_registration_id === 'string' ? m.student_registration_id.trim() : '';
      const src = typeof m?.source === 'string' ? m.source.trim() : '';
      if (sid === studentId && src === 'public_registration' && Math.round(Number(r.amount) * 100) === amountMinor) {
        invoiceId = r.id as string;
        break;
      }
    }

    const displayName = String(stu.full_name || stu.name || 'Student').trim() || 'Student';
    const now = new Date().toISOString();

    if (!invoiceId) {
      const invoiceNumber = `REG-${studentId.replace(/-/g, '').slice(0, 10).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      const meta = {
        student_registration_id: studentId,
        source: 'public_registration',
        enrollment_type: stu.enrollment_type ?? null,
      };
      const { data: inserted, error: insErr } = await admin
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          amount: feeNgn,
          currency: 'NGN',
          status: 'sent',
          notes: `Public registration fee — ${displayName} (${studentId})`,
          metadata: meta,
          portal_user_id: null,
          school_id: null,
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single();

      if (insErr || !inserted?.id) {
        return json({ error: insErr?.message || 'Could not create invoice' }, 500);
      }
      invoiceId = inserted.id as string;
    }

    const reference = `inv_${invoiceId}_${Date.now()}`;
    const initPayload: Record<string, unknown> = {
      email: payerEmail,
      amount: amountMinor,
      reference,
      currency: 'NGN',
      metadata: {
        invoice_id: invoiceId,
        invoice_number: `public-reg-${studentId.slice(0, 8)}`,
        source: 'public_registration',
        student_registration_id: studentId,
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
      invoice_id: invoiceId,
      amount_ngn: feeNgn,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
