// @ts-nocheck
// Unauthenticated: used after public registration Paystack checkout (no logged-in user).
// Verifies with Paystack API then runs the same fulfillment as the webhook.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { fulfillPaystackSuccessfulPayment, mergePaystackChargeMetadata } from '../paystackFulfillShared.ts';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!supabaseUrl || !serviceKey || !paystackSecret) {
      return json({ error: 'Server misconfigured' }, 500);
    }

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
    let metadata: Record<string, unknown> = {};
    const rawMeta = d.metadata;
    if (rawMeta != null) {
      if (typeof rawMeta === 'string') {
        try {
          const parsed = JSON.parse(rawMeta) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            metadata = parsed as Record<string, unknown>;
          }
        } catch {
          metadata = {};
        }
      } else if (typeof rawMeta === 'object' && !Array.isArray(rawMeta)) {
        metadata = rawMeta as Record<string, unknown>;
      }
    }

    metadata = mergePaystackChargeMetadata(d as Record<string, unknown>, metadata);

    const admin = createClient(supabaseUrl, serviceKey);
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
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
