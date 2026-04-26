'use client';

import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { Locale } from '@/lib/locale';

const LANGUAGES: { code: Locale; label: string; flag: string }[] = [
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];

function setAdminLangCookie(locale: Locale) {
  const maxAge = 30 * 24 * 60 * 60; // 30 days
  document.cookie = `admin_lang=${locale}; path=/admin; max-age=${maxAge}; SameSite=Lax`;
}

function getAdminLangCookie(): Locale | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )admin_lang=([^;]*)/);
  if (match && (match[1] === 'vi' || match[1] === 'en')) {
    return match[1] as Locale;
  }
  return null;
}

interface AdminLanguageSelectorProps {
  currentLocale: Locale;
  isDark: boolean;
}

export default function AdminLanguageSelector({ currentLocale, isDark }: AdminLanguageSelectorProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = LANGUAGES.find((l) => l.code === currentLocale) || LANGUAGES[0];

  const handleSelect = useCallback(
    (locale: Locale) => {
      setIsOpen(false);
      setAdminLangCookie(locale);

      // Build new URL preserving all params
      const params = new URLSearchParams(searchParams.toString());
      if (locale === 'vi') {
        params.delete('lang');
      } else {
        params.set('lang', locale);
      }

      const newUrl = `${pathname}?${params.toString()}`;
      router.push(newUrl);
    },
    [pathname, searchParams, router],
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={[
          'flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium transition-all duration-200',
          isDark
            ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-slate-100'
            : 'bg-slate-200/70 text-slate-600 hover:bg-slate-300/70 hover:text-slate-800',
        ].join(' ')}
      >
        <span>{currentLang.flag}</span>
        <span>{currentLang.code.toUpperCase()}</span>
        <svg
          className={['h-3 w-3 transition-transform', isOpen ? 'rotate-180' : ''].join(' ')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className={[
            'absolute right-0 top-full z-[999] mt-1.5 min-w-[130px] overflow-hidden rounded-xl border py-1 shadow-lg',
            'backdrop-blur-xl backdrop-saturate-150',
            isDark ? 'border-white/10 bg-slate-800/90' : 'border-black/[0.08] bg-white/90',
          ].join(' ')}
        >
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelect(lang.code)}
              className={[
                'flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-all duration-150',
                lang.code === currentLocale
                  ? isDark
                    ? 'bg-indigo-500/20 text-indigo-300'
                    : 'bg-indigo-50 text-indigo-700'
                  : isDark
                    ? 'text-slate-300 hover:bg-white/5'
                    : 'text-slate-700 hover:bg-black/[0.04]',
              ].join(' ')}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { getAdminLangCookie, setAdminLangCookie };
