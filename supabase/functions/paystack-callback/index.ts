// @ts-nocheck
// Mobile-friendly page Paystack redirects to after checkout (in-app WebView closes here).
// URL: https://<project-ref>.supabase.co/functions/v1/paystack-callback?reference=...
// Set verify_jwt = false in supabase/config.toml

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function htmlPage(reference: string, trxref: string) {
  const refDisplay = reference || trxref || '—';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#1a0a08" />
  <title>Payment complete · Rillcod</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100dvh;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(165deg, #2d1810 0%, #1a0a08 45%, #0d0605 100%);
      color: #f5f0eb;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: max(24px, env(safe-area-inset-top)) 20px max(32px, env(safe-area-inset-bottom));
      text-align: center;
    }
    .card {
      max-width: 360px;
      width: 100%;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(240,138,75,0.35);
      border-radius: 20px;
      padding: 28px 22px;
      backdrop-filter: blur(12px);
    }
    .icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 16px;
      background: rgba(240,138,75,0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
    }
    h1 {
      font-size: 1.35rem;
      font-weight: 700;
      margin: 0 0 10px;
      letter-spacing: -0.02em;
    }
    p {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.5;
      color: rgba(245,240,235,0.85);
    }
    .ref {
      margin-top: 18px;
      padding: 12px 14px;
      background: rgba(0,0,0,0.35);
      border-radius: 12px;
      font-size: 0.75rem;
      word-break: break-all;
      color: rgba(245,240,235,0.65);
    }
    .hint {
      margin-top: 20px;
      font-size: 0.85rem;
      color: #f08a4b;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10003;</div>
    <h1>Payment received</h1>
    <p>Your transaction was submitted. You can close this screen and return to the <strong>Rillcod</strong> app — your invoice will update automatically.</p>
    <div class="ref">Reference: ${escapeHtml(refDisplay)}</div>
    <p class="hint">← Use the app bar to go back</p>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const reference = url.searchParams.get('reference') ?? '';
  const trxref = url.searchParams.get('trxref') ?? '';

  return new Response(htmlPage(reference, trxref), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
});
