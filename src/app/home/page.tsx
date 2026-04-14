'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { useThemeStore, hydrateTheme } from '@/stores/theme';
import { useLocaleStore } from '@/stores/locale';
import { useTranslation } from '@/lib/i18n';
import { useIframeContext } from '@/hooks/useIframeContext';
import { useIframeResize } from '@/hooks/useIframeResize';
import { postMessageToParent } from '@/lib/iframe-messages';
import { formatStatus, formatVND, getStatusBadgeClass, formatCreatedAt, type MyOrder } from '@/lib/pay-utils';
import LanguageSelector from '@/components/LanguageSelector';
import PendingOrderBanner from '@/components/PendingOrderBanner';
import PayPageLayout from '@/components/PayPageLayout';

function HomeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const themeParam = searchParams.get('theme');
  const { theme, toggleTheme } = useThemeStore();
  const locale = useLocaleStore((s) => s.locale);
  const { t } = useTranslation();
  const { isIframe } = useIframeContext();
  useIframeResize();

  const isDark = theme === 'dark';

  const [user, setUser] = useState<{ id: number; email: string; username: string; balance: number } | null>(null);
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Hydrate theme from URL param on mount
  useEffect(() => {
    if (themeParam) {
      hydrateTheme(themeParam);
    }
  }, [themeParam]);

  useEffect(() => {
    postMessageToParent({ type: 'pay:ready' });
  }, []);

  useEffect(() => {
    if (!token) return;
    const fetchData = async () => {
      try {
        const [userRes, ordersRes] = await Promise.all([
          fetch(`/api/user?token=${encodeURIComponent(token)}`),
          fetch(`/api/orders/my?token=${encodeURIComponent(token)}&page_size=5`),
        ]);
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
        }
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : []);
        }
      } catch {}
      setLoading(false);
    };
    fetchData();
  }, [token]);

  const buildUrl = (path: string) => {
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (locale === 'en') params.set('lang', 'en');
    if (theme) params.set('theme', theme);
    if (isIframe) params.set('ui_mode', 'embedded');
    return `${path}?${params.toString()}`;
  };

  if (!token) {
    return (
      <div suppressHydrationWarning className={['flex min-h-screen items-center justify-center', isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'].join(' ')}>
        <div className={['rounded-2xl p-8 text-center shadow-lg', isDark ? 'bg-slate-900' : 'bg-white'].join(' ')}>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-2xl">
            !
          </div>
          <p className={['text-sm', isDark ? 'text-slate-400' : 'text-slate-600'].join(' ')}>{t('home.noToken')}</p>
        </div>
      </div>
    );
  }

  const navCards = [
    {
      title: t('home.topUp'),
      desc: t('home.topUpDesc'),
      href: buildUrl('/pay'),
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="6" width="22" height="15" rx="2" />
          <path d="M1 10h22" />
          <path d="M12 2L2 6h20L12 2z" />
        </svg>
      ),
      color: isDark ? 'from-blue-600 to-blue-700' : 'from-blue-500 to-blue-600',
      embeddedColor: isDark ? 'from-blue-600/80 to-blue-700/80' : 'from-blue-500/90 to-blue-600/90',
    },
    {
      title: t('home.subscriptions'),
      desc: t('home.subscriptionsDesc'),
      href: buildUrl('/pay/subscriptions'),
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
      color: isDark ? 'from-amber-600 to-amber-700' : 'from-amber-500 to-amber-600',
      embeddedColor: isDark ? 'from-amber-600/80 to-amber-700/80' : 'from-amber-500/90 to-amber-600/90',
    },
    {
      title: t('home.orderHistory'),
      desc: t('home.orderHistoryDesc'),
      href: buildUrl('/pay/orders'),
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
      color: isDark ? 'from-emerald-600 to-emerald-700' : 'from-emerald-500 to-emerald-600',
      embeddedColor: isDark ? 'from-emerald-600/80 to-emerald-700/80' : 'from-emerald-500/90 to-emerald-600/90',
    },
    {
      title: t('home.refund'),
      desc: t('home.refundDesc'),
      href: buildUrl('/pay/orders') + '&filter=REFUND_REQUESTED',
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
        </svg>
      ),
      color: isDark ? 'from-violet-600 to-violet-700' : 'from-violet-500 to-violet-600',
      embeddedColor: isDark ? 'from-violet-600/80 to-violet-700/80' : 'from-violet-500/90 to-violet-600/90',
    },
  ];

  return (
    <PayPageLayout
      isDark={isDark}
      isEmbedded={isIframe}
      isIframe={isIframe}
      title={t('home.title')}
      subtitle={t('home.welcome')}
      actions={
        <div className="flex items-center gap-2">
          <LanguageSelector />
          <button
            type="button"
            onClick={toggleTheme}
            className={[
              'rounded-lg p-1.5 transition-colors',
              isDark ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            ].join(' ')}
          >
            {isDark ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
            )}
          </button>
        </div>
      }
    >
      {/* Language selector for iframe mode */}
      {isIframe && (
        <div className="flex justify-end mb-4">
          <LanguageSelector />
        </div>
      )}

      {/* User info card */}
      {user && (
        <div className={[
          'rounded-2xl p-5 shadow-sm mb-6',
          isIframe
            ? (isDark ? 'bg-slate-900/60 ring-1 ring-slate-700/50 backdrop-blur-sm' : 'bg-white/80 ring-1 ring-slate-300/60 backdrop-blur-sm shadow-md')
            : (isDark ? 'bg-slate-900 ring-1 ring-slate-800' : 'bg-white ring-1 ring-slate-200 shadow-md'),
        ].join(' ')}>
          <div className="flex items-center gap-3">
            <div className={[
              'flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold',
              isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-600',
            ].join(' ')}>
              {(user.username || user.email || 'U')[0].toUpperCase()}
            </div>
            <div>
              <div className={['text-sm font-medium', isDark ? 'text-slate-200' : 'text-slate-800'].join(' ')}>
                {t('home.welcome')}, {user.username || user.email}
              </div>
              <div className={['text-xs', isDark ? 'text-slate-500' : 'text-slate-500'].join(' ')}>
                {t('home.balance')}:{' '}
                <span className={['font-bold', isDark ? 'text-emerald-400' : 'text-emerald-600'].join(' ')}>
                  {user.balance?.toFixed(2) || '0.00'} ☕
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending order notification */}
      <div className="mb-6">
        <PendingOrderBanner orders={orders} dark={isDark} locale={locale} buildPayUrl={(order) => {
          const params = new URLSearchParams();
          if (token) params.set('token', token);
          if (theme) params.set('theme', theme);
          if (locale === 'en') params.set('lang', 'en');
          if (isIframe) params.set('ui_mode', 'embedded');
          params.set('resume_order', order.id);
          // Route subscription orders to subscriptions page for inline QR display
          if (order.orderType === 'subscription') {
            return `/pay/subscriptions?${params.toString()}`;
          }
          return `/pay?${params.toString()}`;
        }} />
      </div>

      {/* Navigation cards */}
      <div className={['grid gap-3 mb-6', isIframe ? 'grid-cols-4' : 'grid-cols-2 sm:grid-cols-4'].join(' ')}>
        {navCards.map((card) => (
          <a
            key={card.title}
            href={card.href}
            className={[
              'group relative overflow-hidden rounded-2xl p-4 text-white shadow-md transition-all hover:shadow-lg active:scale-[0.98]',
              'bg-gradient-to-br',
              isIframe ? `${card.embeddedColor} backdrop-blur-sm` : card.color,
            ].join(' ')}
          >
            <div className="mb-2 opacity-80">{card.icon}</div>
            <div className="text-sm font-bold">{card.title}</div>
            <div className="mt-0.5 text-xs opacity-70">{card.desc}</div>
          </a>
        ))}
      </div>

      {/* Recent orders */}
      <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className={['text-sm font-semibold', isDark ? 'text-slate-300' : 'text-slate-700'].join(' ')}>
              {t('home.recentOrders')}
            </h2>
            {orders.length > 0 && (
              <a
                href={buildUrl('/pay/orders')}
                className={['text-xs font-medium', isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'].join(' ')}
              >
                {t('home.viewAll')} →
              </a>
            )}
          </div>
          {orders.length === 0 ? (
            <div className={[
              'rounded-2xl py-10 text-center',
              isIframe
                ? (isDark ? 'bg-slate-900/60 ring-1 ring-slate-700/50 backdrop-blur-sm' : 'bg-white/80 ring-1 ring-slate-300/60 backdrop-blur-sm shadow-md')
                : (isDark ? 'bg-slate-900 ring-1 ring-slate-800' : 'bg-white ring-1 ring-slate-200 shadow-md'),
            ].join(' ')}>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl dark:bg-slate-800">
                📋
              </div>
              <p className={['text-sm', isDark ? 'text-slate-500' : 'text-slate-500'].join(' ')}>{t('home.noOrders')}</p>
            </div>
          ) : (
            <div className={[
              'divide-y overflow-hidden rounded-2xl shadow-sm',
              isIframe
                ? (isDark ? 'divide-slate-700/50 bg-slate-900/60 ring-1 ring-slate-700/50 backdrop-blur-sm' : 'divide-slate-200 bg-white/80 ring-1 ring-slate-300/60 backdrop-blur-sm shadow-md')
                : (isDark ? 'divide-slate-800 bg-slate-900 ring-1 ring-slate-800' : 'divide-slate-200 bg-white ring-1 ring-slate-200 shadow-md'),
            ].join(' ')}>
              {orders.map((order) => {
                const isSubscription = order.orderType === 'subscription';
                return (
                  <div key={order.id} className={['flex items-center justify-between px-4 py-3', isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-100/80'].join(' ')}>
                    <div>
                      <div className={['text-xs font-mono', isDark ? 'text-slate-500' : 'text-slate-500'].join(' ')}>
                        {order.id}
                      </div>
                      <div className={['text-xs', isDark ? 'text-slate-600' : 'text-slate-500'].join(' ')}>
                        {formatCreatedAt(order.createdAt, locale)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={['text-sm font-semibold', isDark ? 'text-slate-200' : 'text-slate-800'].join(' ')}>
                        {isSubscription
                          ? (order.subscriptionPlanName || (locale === 'vi' ? 'Gói đăng ký' : 'Subscription'))
                          : formatVND(order.amount)}
                      </div>
                      <span className={['inline-block rounded-full px-2 py-0.5 text-[10px] font-medium', getStatusBadgeClass(order.status, isDark)].join(' ')}>
                        {formatStatus(order.status, locale)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
    </PayPageLayout>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
