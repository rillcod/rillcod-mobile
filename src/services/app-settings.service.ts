import { supabase } from '../lib/supabase';

/**
 * Reads `app_settings` (RLS: any authenticated user may select).
 * Used for optional home banner, feature flags, and AI key presence checks.
 */
export class AppSettingsService {
  async getValue(key: string): Promise<string | null> {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle();
    if (error) {
      console.warn('app_settings', key, error.message);
      return null;
    }
    const v = data?.value?.trim();
    return v && v.length > 0 ? v : null;
  }

  /** True when `openrouter_api_key` row has a non-empty value (AI lesson flows). */
  async isOpenRouterConfigured(): Promise<boolean> {
    const v = await this.getValue('openrouter_api_key');
    return Boolean(v && v.length > 8);
  }
}

export const appSettingsService = new AppSettingsService();
