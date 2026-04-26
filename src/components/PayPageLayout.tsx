import React from 'react';
import type { Locale } from '@/lib/locale';

interface PayPageLayoutProps {
  isDark: boolean;
  isEmbedded?: boolean;
  isIframe?: boolean;
  maxWidth?: 'sm' | 'lg' | 'full';
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  backHref?: string;
  children: React.ReactNode;
  locale?: Locale;
}

export default function PayPageLayout({
  isEmbedded = false,
  isIframe = false,
  maxWidth,
  title,
  subtitle,
  actions,
  backHref,
  children,
}: PayPageLayoutProps) {
  const maxWidthClass = maxWidth === 'full' ? '' : maxWidth === 'lg' ? 'max-w-4xl' : 'max-w-2xl';

  return (
    <div className={['pay-layout relative w-full h-screen overflow-hidden flex flex-col p-4 sm:p-6', isEmbedded ? 'embedded' : ''].join(' ')}>
      {!isEmbedded && (
        <>
          <div className="pay-layout-blur-1 pointer-events-none fixed -left-32 -top-32 h-96 w-96 rounded-full blur-[100px]" />
          <div className="pay-layout-blur-2 pointer-events-none fixed -right-32 bottom-0 h-96 w-96 rounded-full blur-[100px]" />
        </>
      )}

      <div
        className={[
          'pay-layout-card relative mx-auto w-full flex flex-col min-h-0 flex-1',
          maxWidthClass,
          isEmbedded ? '' : 'rounded-2xl border backdrop-blur-sm',
        ].join(' ')}
      >
        {/* Header - hidden in iframe mode */}
        {!isIframe && (
          <div className="shrink-0">
            <div className="flex items-center gap-3 p-5 pb-0 sm:p-6 sm:pb-0">
              {backHref ? (
                <a
                  href={backHref}
                  className="pay-layout-back flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </a>
              ) : (
                <div className="pay-layout-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="pay-layout-title truncate text-base font-semibold tracking-tight">{title}</h1>
                <p className="pay-layout-subtitle truncate text-xs">{subtitle}</p>
              </div>
              {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
            </div>
            <div className="pay-layout-divider mx-5 mt-4 border-t sm:mx-6" />
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
