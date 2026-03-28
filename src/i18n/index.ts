import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';
import en from './locales/en';
import fr from './locales/fr';

const i18n = new I18n({ en, fr });

// Auto-detect device language, fall back to English
const deviceLocale = getLocales()[0]?.languageCode ?? 'en';
i18n.locale = ['en', 'fr'].includes(deviceLocale) ? deviceLocale : 'en';
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

export default i18n;

// Convenience helper
export const t = (key: string, options?: Record<string, unknown>) =>
  i18n.t(key, options);
