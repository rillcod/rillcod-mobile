// @ts-nocheck
// Supabase Edge (Deno).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { fulfillPaystackSuccessfulPayment } from '../paystackFulfillShared.ts';

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'GET') {
    return new Response('paystack-webhook ok', { status: 200 });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!secret) {
    return new Response(JSON.stringify({ error: 'Paystack not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature') ?? '';

  const hash = await hmacSha512Hex(secret, rawBody);
  if (!timingSafeEqualHex(hash, signature)) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: { event?: string; data?: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (payload.event !== 'charge.success') {
    return new Response(JSON.stringify({ received: true, ignored: payload.event }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const data = payload.data;
  if (!data || typeof data !== 'object') {
    return new Response(JSON.stringify({ error: 'Missing data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const reference = String(data.reference ?? '');
  const amountKobo = Number(data.amount);
  const paystackId = data.id ?? data.transaction_id ?? '';
  const metadata = (data.metadata && typeof data.metadata === 'object')
    ? (data.metadata as Record<string, unknown>)
    : {};

  if (!reference || !Number.isFinite(amountKobo)) {
    return new Response(JSON.stringify({ error: 'Invalid charge payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const result = await fulfillPaystackSuccessfulPayment(admin, {
    reference,
    amountKobo,
    paystackTransactionId: paystackId,
    metadata,
    gatewayPayload: data,
  });

  if (!result.ok) {
    console.error('paystack-webhook fulfill failed', result.reason);
    return new Response(JSON.stringify({ received: true, fulfilled: false, reason: result.reason }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({ received: true, fulfilled: true, alreadyDone: result.alreadyDone }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
