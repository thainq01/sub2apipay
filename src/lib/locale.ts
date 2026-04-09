export type Locale = 'en' | 'vi';

export function resolveLocale(lang: string | null | undefined): Locale {
  const l = lang?.trim().toLowerCase();
  if (l === 'vi') return 'vi';
  return 'en';
}

export function isEnglish(locale: Locale): boolean {
  return locale === 'en';
}

export function pickLocaleText<T>(locale: Locale, vi: T, en: T): T {
  return locale === 'vi' ? vi : en;
}

export function applyLocaleToSearchParams(params: URLSearchParams, locale: Locale): URLSearchParams {
  if (locale === 'vi') {
    params.set('lang', 'vi');
  }
  return params;
}
