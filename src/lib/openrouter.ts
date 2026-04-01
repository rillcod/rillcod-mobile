/**
 * OpenRouter AI helper aligned to the web AI engine.
 * NOTE: For production, proxy through a Supabase Edge Function so the key
 * is never shipped in the bundle.
 */

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

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CallAIOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  apiKey: string;
}

export async function callAI({
  messages,
  maxTokens = 1024,
  temperature = 0.7,
  apiKey,
}: CallAIOptions): Promise<string> {
  if (!apiKey) throw new Error('No OpenRouter API key configured.');

  for (const model of MODELS_CASCADE) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

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
        }),
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const err = await res.text();
        console.warn(`[openrouter] ${model} -> ${res.status}:`, err);
        continue;
      }

      const data = await res.json();
      const reply: string | undefined = data?.choices?.[0]?.message?.content;
      if (reply?.trim()) return reply.trim();
    } catch (e) {
      console.warn(`[openrouter] ${model} threw:`, e);
    }
  }

  throw new Error('All AI models failed. Please check your connection and try again.');
}

export function pollinationsImageUrl(prompt: string, width = 768, height = 512): string {
  const safe = encodeURIComponent(
    `Educational illustration: ${prompt}. Child-friendly, colourful, classroom-safe, digital art style.`
  );
  return `https://image.pollinations.ai/prompt/${safe}?width=${width}&height=${height}&model=flux&nologo=true`;
}
