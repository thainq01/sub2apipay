import { create } from 'zustand';
import type { Locale } from '@/lib/locale';

interface LocaleStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleStore>((set) => ({
  // Always start 'vi' — matches server. Hydrator corrects before paint.
  locale: 'vi',
  setLocale: (locale) => {
    set({ locale });
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', locale);
    }
  },
}));

export function hydrateLocale(urlLangParam?: string | null): void {
  if (typeof window === 'undefined') return;
  let locale: Locale = 'vi';
  if (urlLangParam === 'en') {
    locale = 'en';
  } else if (urlLangParam === 'vi') {
    locale = 'vi';
  } else {
    const stored = localStorage.getItem('locale');
    if (stored === 'en' || stored === 'vi') locale = stored;
  }
  useLocaleStore.setState({ locale });
  if (urlLangParam) localStorage.setItem('locale', locale);
}
