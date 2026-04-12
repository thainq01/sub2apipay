'use client';

import { useState, useRef, useEffect } from 'react';
import type { Locale } from '@/lib/locale';

interface LanguageSelectorProps {
  locale: Locale;
  onChange: (locale: Locale) => void;
  dark?: boolean;
}

const LANGUAGES: { code: Locale; label: string; flag: string }[] = [
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];

export default function LanguageSelector({ locale, onChange, dark = false }: LanguageSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const current = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];

  const handleSelect = (code: Locale) => {
    setOpen(false);
    if (code === locale) return;

    try {
      localStorage.setItem('locale', code);
    } catch {}

    // Update URL
    const url = new URL(window.location.href);
    if (code === 'vi') {
      url.searchParams.delete('lang');
    } else {
      url.searchParams.set('lang', code);
    }
    window.history.replaceState(null, '', url.toString());

    onChange(code);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={[
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
          dark
            ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
        ].join(' ')}
      >
        <span>{current.flag}</span>
        <span>{current.code.toUpperCase()}</span>
        <svg className={['h-3 w-3 transition-transform', open ? 'rotate-180' : ''].join(' ')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className={[
          'absolute right-0 top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-lg border shadow-lg',
          dark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white',
        ].join(' ')}>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelect(lang.code)}
              className={[
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                locale === lang.code
                  ? dark
                    ? 'bg-indigo-500/20 text-indigo-300'
                    : 'bg-indigo-50 text-indigo-700'
                  : dark
                    ? 'text-slate-300 hover:bg-slate-700'
                    : 'text-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
              {locale === lang.code && (
                <svg className="ml-auto h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
