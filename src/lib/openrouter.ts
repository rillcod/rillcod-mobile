/**
 * OpenRouter AI — requests go through Supabase Edge Function `openrouter-proxy`.
 * The API key is resolved server-side (OPENROUTER_API_KEY secret or `app_settings.openrouter_api_key`); it is never exposed to the client.
 */

import { supabase } from './supabase';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CallAIOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Override model cascade (e.g. web lesson queue). */
  models?: string[];
  /** Per-request timeout in ms (rich lessons need 60s+). */
  timeoutMs?: number;
  /** When set, asks OpenRouter for JSON object output (matches web lesson route). */
  responseFormatJsonObject?: boolean;
}

type ProxyOk = { text: string };
type ProxyErr = { error: string };

async function readInvokeErrorMessage(error: { message: string; context?: Response }): Promise<string> {
  let msg = error.message;
  try {
    const body = await error.context?.json();
    if (body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string') {
      msg = (body as { error: string }).error;
    }
  } catch {
    /* keep message */
  }
  return msg;
}

export async function callAI({
  messages,
  maxTokens = 1024,
  temperature = 0.7,
  models,
  timeoutMs = 25000,
  responseFormatJsonObject = false,
}: CallAIOptions): Promise<string> {
  const { data, error } = await supabase.functions.invoke<ProxyOk & Partial<ProxyErr>>('openrouter-proxy', {
    body: {
      messages,
      maxTokens,
      temperature,
      models,
      timeoutMs,
      responseFormatJsonObject,
    },
  });

  if (error) {
    throw new Error(await readInvokeErrorMessage(error as { message: string; context?: Response }));
  }

  const errMsg = (data as ProxyErr | null)?.error;
  if (errMsg) {
    throw new Error(errMsg);
  }

  const text = (data as ProxyOk | null)?.text?.trim();
  if (!text) {
    throw new Error('AI returned an empty response.');
  }

  return text;
}

export function pollinationsImageUrl(prompt: string, width = 768, height = 512): string {
  const safe = encodeURIComponent(
    `Educational illustration: ${prompt}. Child-friendly, colourful, classroom-safe, digital art style.`,
  );
  return `https://image.pollinations.ai/prompt/${safe}?width=${width}&height=${height}&model=flux&nologo=true`;
}
