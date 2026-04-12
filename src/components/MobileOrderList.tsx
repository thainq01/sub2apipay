'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import OrderFilterBar from '@/components/OrderFilterBar';
import type { Locale } from '@/lib/locale';
import {
  formatStatus,
  formatCreatedAt,
  getStatusBadgeClass,
  getPaymentDisplayInfo,
  type MyOrder,
  type OrderStatusFilter,
} from '@/lib/pay-utils';

interface MobileOrderListProps {
  isDark: boolean;
  hasToken: boolean;
  orders: MyOrder[];
  hasMore: boolean;
  loadingMore: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  locale?: Locale;
}

export default function MobileOrderList({
  isDark,
  hasToken,
  orders,
  hasMore,
  loadingMore,
  onRefresh,
  onLoadMore,
  locale = 'en',
}: MobileOrderListProps) {
  const [activeFilter, setActiveFilter] = useState<OrderStatusFilter>('ALL');
  const sentinelRef = useRef<HTMLDivElement>(null);

  const filteredOrders = useMemo(() => {
    if (activeFilter === 'ALL') return orders;
    return orders.filter((item) => item.status === activeFilter);
  }, [orders, activeFilter]);

  useEffect(() => {
    if (!hasMore || loadingMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className={['text-base font-semibold', isDark ? 'text-slate-100' : 'text-slate-900'].join(' ')}>
          {locale === 'vi' ? 'Các đơn hàng của tôi' : 'My Orders'}
        </h3>
        <button
          type="button"
          onClick={onRefresh}
          className={[
            'rounded-lg border px-2.5 py-1 text-xs font-medium',
            isDark
              ? 'border-slate-600 text-slate-200 hover:bg-slate-800'
              : 'border-slate-300 text-slate-700 hover:bg-slate-100',
          ].join(' ')}
        >
          {locale === 'vi' ? 'Làm mới' : 'Refresh'}
        </button>
      </div>

      <OrderFilterBar isDark={isDark} locale={locale} activeFilter={activeFilter} onChange={setActiveFilter} />

      {!hasToken ? (
        <div
          className={[
            'rounded-xl border border-dashed px-4 py-8 text-center text-sm',
            isDark ? 'border-amber-500/40 text-amber-200' : 'border-amber-300 text-amber-700',
          ].join(' ')}
        >
          {locale === 'vi'
            ? 'Liên kết hiện tại không bao gồm mã thông báo đăng nhập, vì vậy "Các đơn hàng của tôi" không khả dụng.'
            : 'The current link does not include a login token, so "My Orders" is unavailable.'}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div
          className={[
            'rounded-xl border border-dashed px-4 py-8 text-center text-sm',
            isDark ? 'border-slate-600 text-slate-400' : 'border-slate-300 text-slate-500',
          ].join(' ')}
        >
          {locale === 'vi' ? 'Không tìm thấy các đơn hàng phù hợp' : 'No matching orders found'}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className={[
                'rounded-xl border px-3 py-3',
                isDark ? 'border-slate-700 bg-slate-900/70' : 'border-slate-200 bg-white',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl font-semibold">{Math.round(order.amount).toLocaleString('vi-VN')} ☕</span>
                <span
                  className={['rounded-full px-2 py-0.5 text-xs', getStatusBadgeClass(order.status, isDark)].join(' ')}
                >
                  {formatStatus(order.status, locale)}
                </span>
              </div>
              <div className={['mt-1 text-sm', isDark ? 'text-slate-300' : 'text-slate-600'].join(' ')}>
                {getPaymentDisplayInfo(order.paymentType, locale).channel}
              </div>
              <div className={['mt-0.5 text-xs', isDark ? 'text-slate-400' : 'text-slate-500'].join(' ')}>
                {formatCreatedAt(order.createdAt, locale)}
              </div>
            </div>
          ))}

          {hasMore && (
            <div ref={sentinelRef} className="py-3 text-center">
              {loadingMore ? (
                <span className={['text-xs', isDark ? 'text-slate-400' : 'text-slate-500'].join(' ')}>
                  {locale === 'vi' ? 'Đang tải...' : 'Loading...'}
                </span>
              ) : (
                <span className={['text-xs', isDark ? 'text-slate-400' : 'text-slate-400'].join(' ')}>
                  {locale === 'vi' ? 'Trượt lên để tải thêm' : 'Scroll up to load more'}
                </span>
              )}
            </div>
          )}

          {!hasMore && orders.length > 0 && (
            <div className={['py-2 text-center text-xs', isDark ? 'text-slate-400' : 'text-slate-400'].join(' ')}>
              {locale === 'vi' ? 'Đã hiển thị tất cả đơn hàng' : 'All orders loaded'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
