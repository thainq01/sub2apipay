'use client';

import { useSearchParams, usePathname } from 'next/navigation';
import { Suspense, useEffect, useState, useCallback } from 'react';
import { resolveLocale, type Locale } from '@/lib/locale';
import AdminLanguageSelector, { getAdminLangCookie } from '@/components/admin/AdminLanguageSelector';

const NAV_ITEMS = [
  { path: '/admin', label: { vi: 'Tổng quan', en: 'Dashboard' } },
  { path: '/admin/orders', label: { vi: 'Đơn hàng', en: 'Orders' } },
  { path: '/admin/payment-config', label: { vi: 'Thanh toán', en: 'Payment' } },
  { path: '/admin/channels', label: { vi: 'Kênh', en: 'Channels' } },
  { path: '/admin/subscriptions', label: { vi: 'Đăng ký', en: 'Subscriptions' } },
];

function ThemeToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200',
        isDark
          ? 'bg-slate-700/50 text-amber-400 hover:bg-slate-600/50'
          : 'bg-slate-200/70 text-slate-600 hover:bg-slate-300/70',
      ].join(' ')}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      )}
    </button>
  );
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const token = searchParams.get('token') || '';
  const theme = searchParams.get('theme') || 'light';
  const uiMode = searchParams.get('ui_mode') || 'standalone';
  const isDark = theme === 'dark';

  // Resolve locale: URL param > cookie > default 'vi'
  const [locale, setLocale] = useState<Locale>('vi');
  useEffect(() => {
    const langParam = searchParams.get('lang');
    if (langParam) {
      setLocale(resolveLocale(langParam));
    } else {
      const cookieLang = getAdminLangCookie();
      setLocale(cookieLang || 'vi');
    }
  }, [searchParams]);

  const buildUrl = useCallback(
    (path: string, overrideTheme?: string) => {
      const params = new URLSearchParams();
      if (token) params.set('token', token);
      params.set('theme', overrideTheme ?? theme);
      params.set('ui_mode', uiMode);
      if (locale !== 'vi') params.set('lang', locale);
      return `${path}?${params.toString()}`;
    },
    [token, theme, uiMode, locale],
  );

  const toggleTheme = useCallback(() => {
    const newTheme = isDark ? 'light' : 'dark';
    window.location.href = buildUrl(pathname, newTheme);
  }, [isDark, buildUrl, pathname]);

  const isActive = (navPath: string) => {
    if (navPath === '/admin') return pathname === '/admin' || pathname === '/admin/dashboard';
    return pathname.startsWith(navPath);
  };

  return (
    <div data-theme={theme} className={['min-h-screen', isDark ? 'bg-slate-950' : 'bg-slate-100'].join(' ')}>
      <div className="relative z-[1000] w-full px-4 pt-3 sm:px-6 lg:px-8">
        <nav
          className={[
            'mb-3 flex items-center gap-1 rounded-2xl border px-2 py-1.5',
            'backdrop-blur-2xl backdrop-saturate-150',
            isDark
              ? 'border-white/10 bg-gray-900/60 shadow-[0_2px_20px_-2px_rgba(0,0,0,0.4)]'
              : 'border-black/[0.08] bg-white/80 shadow-[0_2px_20px_-2px_rgba(0,0,0,0.1)]',
          ].join(' ')}
        >
          {/* Brand */}
          <div
            className={[
              'flex h-8 items-center gap-2 rounded-xl px-2.5',
              isDark ? 'bg-slate-800/50' : 'bg-slate-100/80',
            ].join(' ')}
          >
            <div
              className={[
                'flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold',
                isDark ? 'bg-indigo-500/30 text-indigo-300' : 'bg-indigo-500 text-white',
              ].join(' ')}
            >
              S
            </div>
            <span className={['text-xs font-semibold', isDark ? 'text-slate-200' : 'text-slate-700'].join(' ')}>
              Sub2API
            </span>
          </div>

          {/* Separator */}
          <div className={['h-4 w-px', isDark ? 'bg-white/10' : 'bg-black/10'].join(' ')} />

          {/* Nav Links */}
          <div className="flex flex-1 flex-wrap items-center gap-0.5">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.path}
                href={buildUrl(item.path)}
                className={[
                  'rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-200',
                  isActive(item.path)
                    ? isDark
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'bg-black/[0.06] text-slate-900 shadow-sm'
                    : isDark
                      ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                      : 'text-slate-500 hover:bg-black/[0.04] hover:text-slate-700',
                ].join(' ')}
              >
                {item.label[locale]}
              </a>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-1">
            <AdminLanguageSelector currentLocale={locale} isDark={isDark} />
            <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
          </div>
        </nav>
      </div>
      {children}
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </Suspense>
  );
}
