'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { resolveLocaleWithStorage, type Locale } from '@/lib/locale';
import { useIframeContext } from '@/hooks/useIframeContext';
import { useIframeResize } from '@/hooks/useIframeResize';
import { postMessageToParent } from '@/lib/iframe-messages';
import { formatStatus, formatVND, getStatusBadgeClass, formatCreatedAt, type MyOrder } from '@/lib/pay-utils';
import LanguageSelector from '@/components/LanguageSelector';
import PendingOrderBanner from '@/components/PendingOrderBanner';

function HomeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const langParam = searchParams.get('lang');
  const [locale, setLocale] = useState<Locale>(() => resolveLocaleWithStorage(langParam));
  const { isIframe } = useIframeContext();
  useIframeResize();

  const [user, setUser] = useState<{ id: number; email: string; username: string; balance: number } | null>(null);
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark' || stored === 'light') {
        setDark(stored === 'dark');
        return;
      }
    } catch {}
    setDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);

  useEffect(() => {
    postMessageToParent({ type: 'pay:ready' });
  }, []);

  useEffect(() => {
    if (!token) return;
    const fetchData = async () => {
      try {
        const [userRes, ordersRes] = await Promise.all([
          fetch(`/api/user?token=${encodeURIComponent(token)}`),
          fetch(`/api/orders?token=${encodeURIComponent(token)}&limit=5`),
        ]);
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
        }
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          setOrders(ordersData.orders || []);
        }
      } catch {}
      setLoading(false);
    };
    fetchData();
  }, [token]);

  const t = {
    title: locale === 'vi' ? 'Bảng điều khiển' : 'Dashboard',
    welcome: locale === 'vi' ? 'Xin chào' : 'Welcome',
    balance: locale === 'vi' ? 'Số dư' : 'Balance',
    topUp: locale === 'vi' ? 'Nạp tiền' : 'Top Up',
    topUpDesc: locale === 'vi' ? 'Nạp tiền vào tài khoản' : 'Add funds to your account',
    orderHistory: locale === 'vi' ? 'Lịch sử đơn hàng' : 'Order History',
    orderHistoryDesc: locale === 'vi' ? 'Xem các giao dịch trước đây' : 'View past transactions',
    refund: locale === 'vi' ? 'Yêu cầu hoàn tiền' : 'Refund Requests',
    refundDesc: locale === 'vi' ? 'Quản lý yêu cầu hoàn tiền' : 'Manage your refund requests',
    recentOrders: locale === 'vi' ? 'Giao dịch gần đây' : 'Recent Transactions',
    noOrders: locale === 'vi' ? 'Chưa có giao dịch nào' : 'No transactions yet',
    viewAll: locale === 'vi' ? 'Xem tất cả' : 'View All',
    noToken: locale === 'vi' ? 'Vui lòng đăng nhập để tiếp tục' : 'Please sign in to continue',
  };

  const buildUrl = (path: string) => {
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (locale === 'en') params.set('lang', 'en');
    return `${path}?${params.toString()}`;
  };

  if (!token) {
    return (
      <div className={['flex min-h-screen items-center justify-center', dark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'].join(' ')}>
        <div className={['rounded-2xl p-8 text-center shadow-lg', dark ? 'bg-slate-900' : 'bg-white'].join(' ')}>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-2xl">
            !
          </div>
          <p className={['text-sm', dark ? 'text-slate-400' : 'text-slate-600'].join(' ')}>{t.noToken}</p>
        </div>
      </div>
    );
  }

  const navCards = [
    {
      title: t.topUp,
      desc: t.topUpDesc,
      href: buildUrl('/pay'),
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="6" width="22" height="15" rx="2" />
          <path d="M1 10h22" />
          <path d="M12 2L2 6h20L12 2z" />
        </svg>
      ),
      color: dark ? 'from-blue-600 to-blue-700' : 'from-blue-500 to-blue-600',
    },
    {
      title: t.orderHistory,
      desc: t.orderHistoryDesc,
      href: buildUrl('/pay/orders'),
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
      color: dark ? 'from-emerald-600 to-emerald-700' : 'from-emerald-500 to-emerald-600',
    },
    {
      title: t.refund,
      desc: t.refundDesc,
      href: buildUrl('/pay/orders') + '&filter=REFUND_REQUESTED',
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
        </svg>
      ),
      color: dark ? 'from-violet-600 to-violet-700' : 'from-violet-500 to-violet-600',
    },
  ];

  return (
    <div className={['min-h-screen transition-colors', dark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'].join(' ')}>
      <div className={['mx-auto w-full max-w-2xl', isIframe ? 'p-3' : 'p-4 sm:p-6'].join(' ')}>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className={['font-bold', isIframe ? 'text-lg' : 'text-xl'].join(' ')}>{t.title}</h1>
          <div className="flex items-center gap-2">
            <LanguageSelector locale={locale} onChange={setLocale} dark={dark} />
            <button
              type="button"
              onClick={() => { const next = !dark; setDark(next); try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {} }}
              className={[
                'rounded-lg p-1.5 transition-colors',
                dark ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              ].join(' ')}
            >
              {dark ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
              )}
            </button>
          </div>
        </div>

        {/* User info card */}
        {loading ? (
          <div className={['animate-pulse rounded-2xl p-6', dark ? 'bg-slate-900' : 'bg-white'].join(' ')}>
            <div className={['h-4 w-32 rounded', dark ? 'bg-slate-800' : 'bg-slate-200'].join(' ')} />
            <div className={['mt-3 h-8 w-48 rounded', dark ? 'bg-slate-800' : 'bg-slate-200'].join(' ')} />
          </div>
        ) : user ? (
          <div className={[
            'rounded-2xl p-5 shadow-sm',
            dark ? 'bg-slate-900 ring-1 ring-slate-800' : 'bg-white ring-1 ring-slate-100',
          ].join(' ')}>
            <div className="flex items-center gap-3">
              <div className={[
                'flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold',
                dark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-600',
              ].join(' ')}>
                {(user.username || user.email || 'U')[0].toUpperCase()}
              </div>
              <div>
                <div className={['text-sm font-medium', dark ? 'text-slate-200' : 'text-slate-800'].join(' ')}>
                  {t.welcome}, {user.username || user.email}
                </div>
                <div className={['text-xs', dark ? 'text-slate-500' : 'text-slate-400'].join(' ')}>
                  {t.balance}:{' '}
                  <span className={['font-bold', dark ? 'text-emerald-400' : 'text-emerald-600'].join(' ')}>
                    {user.balance?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Pending order notification */}
        <PendingOrderBanner orders={orders} dark={dark} locale={locale} buildPayUrl={() => buildUrl('/pay')} />

        {/* Navigation cards */}
        <div className={['grid gap-3', isIframe ? 'mt-4 grid-cols-3' : 'mt-5 grid-cols-1 sm:grid-cols-3'].join(' ')}>
          {navCards.map((card) => (
            <a
              key={card.title}
              href={card.href}
              className={[
                'group relative overflow-hidden rounded-2xl p-4 text-white shadow-md transition-all hover:shadow-lg active:scale-[0.98]',
                `bg-gradient-to-br ${card.color}`,
              ].join(' ')}
            >
              <div className="mb-2 opacity-80">{card.icon}</div>
              <div className="text-sm font-bold">{card.title}</div>
              {!isIframe && (
                <div className="mt-0.5 text-xs opacity-70">{card.desc}</div>
              )}
            </a>
          ))}
        </div>

        {/* Recent orders */}
        {!isIframe && (
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className={['text-sm font-semibold', dark ? 'text-slate-300' : 'text-slate-700'].join(' ')}>
                {t.recentOrders}
              </h2>
              {orders.length > 0 && (
                <a
                  href={buildUrl('/pay/orders')}
                  className={['text-xs font-medium', dark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'].join(' ')}
                >
                  {t.viewAll} →
                </a>
              )}
            </div>
            {orders.length === 0 ? (
              <div className={[
                'rounded-2xl py-10 text-center',
                dark ? 'bg-slate-900 ring-1 ring-slate-800' : 'bg-white ring-1 ring-slate-100',
              ].join(' ')}>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl dark:bg-slate-800">
                  📋
                </div>
                <p className={['text-sm', dark ? 'text-slate-500' : 'text-slate-400'].join(' ')}>{t.noOrders}</p>
              </div>
            ) : (
              <div className={[
                'divide-y overflow-hidden rounded-2xl shadow-sm',
                dark ? 'divide-slate-800 bg-slate-900 ring-1 ring-slate-800' : 'divide-slate-100 bg-white ring-1 ring-slate-100',
              ].join(' ')}>
                {orders.map((order) => (
                  <div key={order.id} className={['flex items-center justify-between px-4 py-3', dark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'].join(' ')}>
                    <div>
                      <div className={['text-xs font-mono', dark ? 'text-slate-500' : 'text-slate-400'].join(' ')}>
                        {order.id}
                      </div>
                      <div className={['text-xs', dark ? 'text-slate-600' : 'text-slate-400'].join(' ')}>
                        {formatCreatedAt(order.createdAt, locale)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={['text-sm font-semibold', dark ? 'text-slate-200' : 'text-slate-800'].join(' ')}>
                        {formatVND(order.amount)}
                      </div>
                      <span className={['inline-block rounded-full px-2 py-0.5 text-[10px] font-medium', getStatusBadgeClass(order.status, dark)].join(' ')}>
                        {formatStatus(order.status, locale)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
