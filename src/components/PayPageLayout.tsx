import React from 'react';
import type { Locale } from '@/lib/locale';

interface PayPageLayoutProps {
  isDark: boolean;
  isEmbedded?: boolean;
  maxWidth?: 'sm' | 'lg' | 'full';
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  locale?: Locale;
}

export default function PayPageLayout({
  isDark,
  isEmbedded = false,
  maxWidth = 'full',
  title,
  subtitle,
  actions,
  children,
  locale = 'en',
}: PayPageLayoutProps) {
  const maxWidthClass = maxWidth === 'sm' ? 'max-w-lg' : maxWidth === 'lg' ? 'max-w-4xl' : '';

  return (
    <div
      data-theme={isDark ? 'dark' : 'light'}
      className={[
        'relative w-full overflow-auto',
        isEmbedded
          ? 'flex min-h-full items-start justify-center p-2'
          : 'flex min-h-screen items-center justify-center p-4 sm:p-6',
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900',
      ].join(' ')}
    >
      {!isEmbedded && (
        <>
          <div
            className={[
              'pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full blur-[100px]',
              isDark ? 'bg-indigo-500/15' : 'bg-blue-400/20',
            ].join(' ')}
          />
          <div
            className={[
              'pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full blur-[100px]',
              isDark ? 'bg-cyan-400/10' : 'bg-violet-300/20',
            ].join(' ')}
          />
        </>
      )}

      <div
        className={[
          'relative mx-auto w-full',
          maxWidthClass,
          isEmbedded
            ? isDark
              ? 'bg-slate-900'
              : 'bg-white'
            : [
                'my-auto rounded-2xl border backdrop-blur-sm',
                isDark
                  ? 'border-slate-800 bg-slate-900/90 shadow-2xl shadow-black/40'
                  : 'border-white/80 bg-white/80 shadow-xl shadow-slate-200/60 ring-1 ring-slate-200/50',
              ].join(' '),
        ].join(' ')}
      >
        {/* Header */}
        <div className={[
          'flex flex-col gap-3 p-5 pb-0 sm:flex-row sm:items-center sm:justify-between sm:p-6 sm:pb-0',
        ].join(' ')}>
          <div className="flex items-center gap-3">
            <div className={[
              'flex h-10 w-10 items-center justify-center rounded-xl',
              isDark ? 'bg-indigo-500/20' : 'bg-gradient-to-br from-indigo-500 to-violet-500',
            ].join(' ')}>
              <svg className={['h-5 w-5', isDark ? 'text-indigo-300' : 'text-white'].join(' ')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <h1 className={['text-lg font-semibold tracking-tight', isDark ? 'text-slate-100' : 'text-slate-900'].join(' ')}>
                {title}
              </h1>
              <p className={['text-xs', isDark ? 'text-slate-500' : 'text-slate-400'].join(' ')}>{subtitle}</p>
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
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
