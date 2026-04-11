/// <reference path="../deno-ambient.d.ts" />
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const READ_ALLOWED_PREFIXES = [
  'assignment-submissions/',
  'avatars/',
  'payment-proofs/',
];

function normalizeBase(url: string) {
  return url.replace(/\/+$/, '');
}

/** Strip configured public origin → object key inside the bucket. */
function objectKeyFromPublicUrl(publicFileUrl: string, publicBaseEnv: string): string | null {
  const base = normalizeBase(publicBaseEnv);
  const u = publicFileUrl.trim().split('?')[0];
  if (!u) return null;
  if (u.startsWith(base + '/')) {
    return decodeURIComponent(u.slice(base.length + 1)) || null;
  }
  if (u.startsWith(base)) {
    const rest = u.slice(base.length).replace(/^\/+/, '');
    return decodeURIComponent(rest) || null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as {
      mode?: string;
      key?: string;
      contentType?: string;
      publicUrl?: string;
    };

    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')!;
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')!;
    const accountId = Deno.env.get('R2_ACCOUNT_ID')!;
    const bucket = Deno.env.get('R2_BUCKET_NAME')!;
    const publicBase = Deno.env.get('R2_PUBLIC_URL')!;

    const r2 = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: 's3',
      region: 'auto',
    });

    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

    if (body.mode === 'get') {
      let objectKey = (body.key ?? '').trim();
      if (!objectKey && body.publicUrl) {
        const extracted = objectKeyFromPublicUrl(body.publicUrl, publicBase);
        objectKey = extracted ?? '';
      }
      if (!objectKey) {
        return new Response(JSON.stringify({ error: 'key or publicUrl is required for mode=get' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!READ_ALLOWED_PREFIXES.some((p) => objectKey.startsWith(p))) {
        return new Response(JSON.stringify({ error: 'Key prefix not allowed for read' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const objectUrl = `${endpoint}/${bucket}/${objectKey}`;
      const signed = await r2.sign(new Request(objectUrl, { method: 'GET' }), {
        aws: { signQuery: true },
        expiresIn: 3600,
      });

      return new Response(JSON.stringify({ viewUrl: signed.url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { key, contentType } = body;
    if (!key || !contentType) {
      return new Response(JSON.stringify({ error: 'key and contentType are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const objectUrl = `${endpoint}/${bucket}/${key}`;
    const signed = await r2.sign(
      new Request(objectUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
      }),
      { aws: { signQuery: true }, expiresIn: 3600 },
    );

    return new Response(
      JSON.stringify({
        uploadUrl: signed.url,
        publicUrl: `${normalizeBase(publicBase)}/${key}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
