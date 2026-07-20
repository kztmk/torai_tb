import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import ja from './locales/ja';

export const supportedLanguages = [
  { code: 'ja', labelKey: 'common.japanese', nativeLabel: '日本語' },
  { code: 'en', labelKey: 'common.english', nativeLabel: 'English' },
] as const;

export type AppLanguage = (typeof supportedLanguages)[number]['code'];

export const LANGUAGE_STORAGE_KEY = 'torai-language';

export function normalizeAppLanguage(value: unknown): AppLanguage | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase().split('-')[0];
  return supportedLanguages.some(({ code }) => code === normalized)
    ? (normalized as AppLanguage)
    : null;
}

export function detectInitialLanguage(): AppLanguage {
  if (typeof window !== 'undefined') {
    const stored = normalizeAppLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
    if (stored !== null) {
      return stored;
    }
    return window.navigator.languages?.some((language) => language.toLowerCase().startsWith('ja'))
      ? 'ja'
      : 'en';
  }
  return 'ja';
}

export function getAppLanguage(): AppLanguage {
  return normalizeAppLanguage(i18n.resolvedLanguage || i18n.language) || detectInitialLanguage();
}

export async function setAppLanguage(language: AppLanguage) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }
  if (i18n.resolvedLanguage !== language) {
    await i18n.changeLanguage(language);
  }
}

void i18n.use(initReactI18next).init({
  resources: {
    ja: { translation: ja },
    en: { translation: en },
  },
  lng: detectInitialLanguage(),
  fallbackLng: 'ja',
  supportedLngs: supportedLanguages.map(({ code }) => code),
  interpolation: { escapeValue: false },
  returnNull: false,
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = getAppLanguage();
}

export default i18n;
