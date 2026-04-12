import { useLocaleStore } from '@/stores/locale';
import vi from './vi';
import en from './en';

const dictionaries: Record<string, Record<string, string>> = { vi, en };

export function useTranslation() {
  const locale = useLocaleStore((s) => s.locale);
  const dict = dictionaries[locale] || dictionaries.vi;

  const t = (key: string, params?: Record<string, string | number>): string => {
    let value = dict[key] || dictionaries.vi[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(`{{${k}}}`, String(v));
      }
    }
    return value;
  };

  return { t, locale };
}

export type { Locale } from '@/lib/locale';
