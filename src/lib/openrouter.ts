/**
 * OpenRouter AI helper — direct from mobile.
 * Primary: gemini-2.0-flash  | Fallback: qwen3-235b:free → glm-z1-flash:free
 *
 * NOTE: For production, proxy through a Supabase Edge Function so the key
 * is never shipped in the bundle.
 */

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

// Cascade: try each model in order, return first successful reply
const MODELS_CASCADE = [
  'google/gemini-2.0-flash-001',
  'qwen/qwen3-235b-a22b:free',
  'qwen/qwen3-30b-a3b:free',
  'zhipuai/glm-z1-flash:free',
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

/** Call OpenRouter with automatic model fallback. Returns the reply text or throws. */
export async function callAI({
  messages,
  maxTokens = 1024,
  temperature = 0.7,
  apiKey,
}: CallAIOptions): Promise<string> {
  if (!apiKey) throw new Error('No OpenRouter API key configured.');

  for (const model of MODELS_CASCADE) {
    try {
      const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://rillcod.com',
          'X-Title': 'Rillcod Academy',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.warn(`[openrouter] ${model} → ${res.status}:`, err);
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

/**
 * Generate an educational image using Pollinations.ai (free, no auth).
 * Returns a URL string.
 */
export function pollinationsImageUrl(prompt: string, width = 768, height = 512): string {
  const safe = encodeURIComponent(
    `Educational illustration: ${prompt}. Child-friendly, colourful, classroom-safe, digital art style.`
  );
  return `https://image.pollinations.ai/prompt/${safe}?width=${width}&height=${height}&model=flux&nologo=true`;
}
