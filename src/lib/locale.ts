export type Locale = 'en' | 'vi';

export function resolveLocale(lang: string | null | undefined): Locale {
  const l = lang?.trim().toLowerCase();
  if (l === 'en') return 'en';
  return 'vi';
}

export function isEnglish(locale: Locale): boolean {
  return locale === 'en';
}

export function pickLocaleText<T>(locale: Locale, vi: T, en: T): T {
  return locale === 'vi' ? vi : en;
}

export function applyLocaleToSearchParams(params: URLSearchParams, locale: Locale): URLSearchParams {
  if (locale === 'en') {
    params.set('lang', 'en');
  } else {
    params.delete('lang');
  }
  return params;
}

/**
 * Resolve locale with localStorage persistence.
 * Priority: URL param → localStorage → default 'vi'
 */
export function resolveLocaleWithStorage(langParam: string | null | undefined): Locale {
  if (typeof window === 'undefined') {
    return resolveLocale(langParam);
  }

  // URL param takes highest priority
  if (langParam) {
    const locale = resolveLocale(langParam);
    try {
      localStorage.setItem('locale', locale);
    } catch {}
    return locale;
  }

  // Check localStorage
  try {
    const stored = localStorage.getItem('locale');
    if (stored === 'en' || stored === 'vi') return stored;
  } catch {}

  return 'vi';
}
