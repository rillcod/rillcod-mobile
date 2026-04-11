/// <reference path="../deno-ambient.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

const MODELS_CASCADE = [
  'google/gemini-2.0-flash-001',
  'x-ai/grok-2-1212',
  'moonshotai/kimi-k2.5',
  'deepseek/deepseek-chat-v3-5',
  'deepseek/deepseek-chat',
  'deepseek/deepseek-r1:free',
  'qwen/qwen3-235b-a22b:free',
  'qwen/qwen3-30b-a3b:free',
  'qwen/qwen3-14b:free',
  'minimax/minimax-01',
  'zhipuai/glm-4-flash:free',
  'zhipuai/glm-z1-flash:free',
  'stepfun/step-3-5-flash',
  'xiaomi/mimo-v2-flash:free',
  'google/gemini-2.0-flash-lite-001',
  'meta-llama/llama-3.3-70b-instruct',
  'mistralai/mistral-large-2411',
  'meta-llama/llama-3.1-8b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
];

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function resolveOpenRouterKey(admin: ReturnType<typeof createClient>): Promise<string> {
  const fromEnv = Deno.env.get('OPENROUTER_API_KEY')?.trim() ?? '';
  if (fromEnv) return fromEnv;

  const { data, error } = await admin
    .from('app_settings')
    .select('value')
    .eq('key', 'openrouter_api_key')
    .maybeSingle();

  if (error) throw new Error(`app_settings: ${error.message}`);
  return data?.value?.trim() ?? '';
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

    let body: {
      messages?: ChatMessage[];
      maxTokens?: number;
      temperature?: number;
      models?: string[];
      timeoutMs?: number;
      responseFormatJsonObject?: boolean;
    };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'messages[] is required' }, 400);
    }

    const maxTokens = Math.min(32768, Math.max(1, Number(body.maxTokens) || 1024));
    const temperature = Math.min(2, Math.max(0, Number(body.temperature) ?? 0.7));
    const timeoutMs = Math.min(180000, Math.max(5000, Number(body.timeoutMs) || 25000));
    const responseFormatJsonObject = Boolean(body.responseFormatJsonObject);
    const cascade = Array.isArray(body.models) && body.models.length > 0 ? body.models : MODELS_CASCADE;

    const apiKey = await resolveOpenRouterKey(admin);
    if (!apiKey) {
      return json(
        {
          error:
            'OpenRouter is not configured. Set secret OPENROUTER_API_KEY or app_settings.openrouter_api_key (server-side only).',
        },
        503,
      );
    }

    let lastErr = 'All AI models failed.';
    for (const model of cascade) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://rillcod.com',
            'X-Title': 'Rillcod Academy',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
            ...(responseFormatJsonObject ? { response_format: { type: 'json_object' } } : {}),
          }),
        });

        clearTimeout(timeout);

        if (!res.ok) {
          lastErr = await res.text();
          continue;
        }

        const data = await res.json();
        const reply: string | undefined = data?.choices?.[0]?.message?.content;
        if (reply?.trim()) {
          return json({ text: reply.trim() });
        }
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }

    return json({ error: lastErr }, 502);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
