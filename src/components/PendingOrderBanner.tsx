'use client';

import { useEffect, useState } from 'react';
import type { Locale } from '@/lib/locale';
import type { MyOrder } from '@/lib/pay-utils';

interface PendingOrderBannerProps {
  orders: MyOrder[];
  dark: boolean;
  locale: Locale;
  buildPayUrl?: (orderId: string) => string;
}

function getTimeRemaining(expiresAt: string): { minutes: number; seconds: number; expired: boolean } {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { minutes: 0, seconds: 0, expired: true };
  return {
    minutes: Math.floor(diff / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    expired: false,
  };
}

export default function PendingOrderBanner({ orders, dark, locale, buildPayUrl }: PendingOrderBannerProps) {
  const pendingOrders = orders.filter((o) => o.status === 'PENDING' && o.expiresAt);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (pendingOrders.length === 0) return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [pendingOrders.length]);

  if (pendingOrders.length === 0) return null;

  const t = locale === 'vi'
    ? { pending: 'Bạn có đơn hàng đang chờ thanh toán', expires: 'Hết hạn sau', expired: 'Đã hết hạn', continuePay: 'Tiếp tục', order: 'Đơn' }
    : { pending: 'You have a pending transaction', expires: 'Expires in', expired: 'Expired', continuePay: 'Continue', order: 'Order' };

  return (
    <div className="space-y-2 mb-4">
      {pendingOrders.slice(0, 3).map((order) => {
        const remaining = getTimeRemaining(order.expiresAt!);
        const timeStr = remaining.expired
          ? t.expired
          : `${t.expires} ${remaining.minutes}:${String(remaining.seconds).padStart(2, '0')}`;

        return (
          <div
            key={order.id}
            className={[
              'flex items-center gap-3 rounded-xl border px-4 py-3',
              remaining.expired
                ? dark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'
                : dark ? 'border-amber-500/30 bg-amber-500/10' : 'border-amber-200 bg-amber-50',
            ].join(' ')}
          >
            <div className={[
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm',
              remaining.expired
                ? dark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                : dark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-600',
            ].join(' ')}>
              {remaining.expired ? '!' : (
                <svg className="h-4 w-4 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className={['text-sm font-medium', dark ? 'text-slate-200' : 'text-slate-800'].join(' ')}>
                {t.pending}
              </div>
              <div className={['text-xs', remaining.expired ? dark ? 'text-slate-500' : 'text-slate-400' : dark ? 'text-amber-300/80' : 'text-amber-600/80'].join(' ')}>
                #{order.id.slice(0, 10)} · {Math.round(order.amount)} ☕ · {timeStr}
              </div>
            </div>
            {buildPayUrl && !remaining.expired && (
              <a
                href={buildPayUrl(order.id)}
                className={[
                  'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  dark ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-amber-500 text-white hover:bg-amber-600',
                ].join(' ')}
              >
                {t.continuePay}
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
