import React from 'react';
import type { Locale } from '@/lib/locale';

interface PayPageLayoutProps {
  isDark: boolean;
  isEmbedded?: boolean;
  maxWidth?: 'sm' | 'lg' | 'full';
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  backHref?: string;
  children: React.ReactNode;
  locale?: Locale;
}

export default function PayPageLayout({
  isDark,
  isEmbedded = false,
  maxWidth,
  title,
  subtitle,
  actions,
  backHref,
  children,
}: PayPageLayoutProps) {
  const maxWidthClass = maxWidth === 'lg' ? 'max-w-4xl' : 'max-w-2xl';

  return (
    <div
      data-theme={isDark ? 'dark' : 'light'}
      className={[
        'relative w-full overflow-auto',
        isEmbedded
          ? 'min-h-full p-2'
          : 'min-h-screen p-4 sm:p-6',
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900',
      ].join(' ')}
    >
      {!isEmbedded && (
        <>
          <div className={['pointer-events-none fixed -left-32 -top-32 h-96 w-96 rounded-full blur-[100px]', isDark ? 'bg-indigo-500/15' : 'bg-blue-400/20'].join(' ')} />
          <div className={['pointer-events-none fixed -right-32 bottom-0 h-96 w-96 rounded-full blur-[100px]', isDark ? 'bg-cyan-400/10' : 'bg-violet-300/20'].join(' ')} />
        </>
      )}

      <div
        className={[
          'relative mx-auto w-full',
          maxWidthClass,
          isEmbedded
            ? isDark ? 'bg-slate-900' : 'bg-white'
            : [
                'min-h-[calc(100vh-2rem)] sm:min-h-[calc(100vh-3rem)] rounded-2xl border backdrop-blur-sm',
                isDark
                  ? 'border-slate-800 bg-slate-900/90 shadow-2xl shadow-black/40'
                  : 'border-white/80 bg-white/80 shadow-xl shadow-slate-200/60 ring-1 ring-slate-200/50',
              ].join(' '),
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-5 pb-0 sm:p-6 sm:pb-0">
          {backHref ? (
            <a
              href={backHref}
              className={[
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors',
                isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              ].join(' ')}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </a>
          ) : (
            <div className={[
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              isDark ? 'bg-indigo-500/20' : 'bg-gradient-to-br from-indigo-500 to-violet-500',
            ].join(' ')}>
              <svg className={['h-5 w-5', isDark ? 'text-indigo-300' : 'text-white'].join(' ')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className={['truncate text-base font-semibold tracking-tight', isDark ? 'text-slate-100' : 'text-slate-900'].join(' ')}>
              {title}
            </h1>
            <p className={['truncate text-xs', isDark ? 'text-slate-500' : 'text-slate-400'].join(' ')}>{subtitle}</p>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>

        {/* Divider */}
        <div className={['mx-5 mt-4 border-t sm:mx-6', isDark ? 'border-slate-800' : 'border-slate-100'].join(' ')} />

        {/* Content */}
        <div className="p-5 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
