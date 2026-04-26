'use client';

import { useState, useEffect } from 'react';
import PayPageLayout from '@/components/PayPageLayout';
import OrderFilterBar from '@/components/OrderFilterBar';
import OrderSummaryCards from '@/components/OrderSummaryCards';
import OrderTable from '@/components/OrderTable';
import PaginationBar from '@/components/PaginationBar';
import { applyLocaleToSearchParams, pickLocaleText, resolveLocale } from '@/lib/locale';
import { PRODUCT_NAME } from '@/lib/constants';
import { detectDeviceIsMobile, type UserInfo, type MyOrder, type OrderStatusFilter } from '@/lib/pay-utils';
import { useThemeStore } from '@/stores/theme';
import { navigateToScreen, type ScreenNavParams } from '@/lib/screen-nav';

const PAGE_SIZE_OPTIONS = [20, 50, 100];

interface Summary {
  total: number;
  pending: number;
  completed: number;
  failed: number;
}

interface OrdersScreenProps {
  token: string;
  isIframe: boolean;
  navParams: ScreenNavParams;
}

export default function OrdersScreen({ token, isIframe, navParams }: OrdersScreenProps) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const locale = resolveLocale(navParams.lang);

  const text = {
    missingAuth: pickLocaleText(locale, 'Missing authentication information', 'Missing authentication information'),
    visitOrders: pickLocaleText(locale, `Please open the orders page from ${PRODUCT_NAME}`, `Please open the orders page from ${PRODUCT_NAME}`),
    sessionExpired: pickLocaleText(locale, `Session expired. Please re-enter from ${PRODUCT_NAME}.`, `Session expired. Please re-enter from ${PRODUCT_NAME}.`),
    loadFailed: pickLocaleText(locale, 'Failed to load orders. Please try again later.', 'Failed to load orders. Please try again later.'),
    networkError: pickLocaleText(locale, 'Network error. Please try again later.', 'Network error. Please try again later.'),
    myOrders: pickLocaleText(locale, 'My Orders', 'My Orders'),
    refresh: pickLocaleText(locale, 'Refresh', 'Refresh'),
    backToPay: pickLocaleText(locale, 'Back to Top Up', 'Back to Top Up'),
    loading: pickLocaleText(locale, 'Loading...', 'Loading...'),
    userPrefix: pickLocaleText(locale, 'User', 'User'),
    authError: pickLocaleText(locale, `Missing authentication information. Please open the orders page from ${PRODUCT_NAME}.`, `Missing authentication information. Please open the orders page from ${PRODUCT_NAME}.`),
    refundRequestFailed: pickLocaleText(locale, 'Refund request failed. Please try again later.', 'Refund request failed. Please try again later.'),
  };

  const [isMobile, setIsMobile] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, pending: 0, completed: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<OrderStatusFilter>(() => {
    if (navParams.filter) {
      const validFilters: OrderStatusFilter[] = ['ALL', 'PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUND_REQUESTED', 'REFUNDING', 'PARTIALLY_REFUNDED', 'REFUNDED', 'REFUND_FAILED'];
      if (validFilters.includes(navParams.filter as OrderStatusFilter)) {
        return navParams.filter as OrderStatusFilter;
      }
    }
    return 'ALL';
  });
  const [resolvedUserId, setResolvedUserId] = useState<number | null>(null);

  const [page, setPage] = useState(navParams.page ? Number(navParams.page) : 1);
  const [pageSize, setPageSize] = useState(navParams.page_size ? Number(navParams.page_size) : 20);
  const [totalPages, setTotalPages] = useState(1);

  const isEmbedded = navParams.ui_mode === 'embedded' || isIframe;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsMobile(detectDeviceIsMobile());
  }, []);

  // On mobile, navigate to pay screen with orders tab
  useEffect(() => {
    if (!isMobile || isEmbedded) return;
    navigateToScreen({ ...navParams, screen: 'pay', tab: 'orders' });
  }, [isMobile, isEmbedded, navParams]);

  const loadOrders = async (targetPage = page, targetPageSize = pageSize) => {
    setLoading(true);
    setError('');
    try {
      if (!token) {
        setOrders([]);
        setError(text.authError);
        return;
      }

      const params = new URLSearchParams({
        token,
        page: String(targetPage),
        page_size: String(targetPageSize),
      });
      const res = await fetch(`/api/orders/my?${params}`);
      if (!res.ok) {
        setError(res.status === 401 ? text.sessionExpired : text.loadFailed);
        setOrders([]);
        return;
      }

      const data = await res.json();
      const meUser = data.user || {};
      const meId = Number(meUser.id);
      if (Number.isInteger(meId) && meId > 0) setResolvedUserId(meId);

      setUserInfo({
        id: Number.isInteger(meId) && meId > 0 ? meId : undefined,
        username:
          (typeof meUser.displayName === 'string' && meUser.displayName.trim()) ||
          (typeof meUser.username === 'string' && meUser.username.trim()) ||
          `${text.userPrefix} #${meId}`,
        balance: typeof meUser.balance === 'number' ? meUser.balance : 0,
      });

      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setSummary(data.summary ?? { total: 0, pending: 0, completed: 0, failed: 0 });
      setPage(data.page ?? targetPage);
      setTotalPages(data.total_pages ?? 1);
    } catch {
      setOrders([]);
      setError(text.networkError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isMobile && !isEmbedded) return;
    loadOrders(1, pageSize);
  }, [token, isMobile, isEmbedded]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadOrders(newPage, pageSize);
    // Update URL without reload
    navigateToScreen({ ...navParams, page: newPage > 1 ? newPage : null });
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    loadOrders(1, newSize);
    navigateToScreen({ ...navParams, page: null, page_size: newSize });
  };

  const handleFilterChange = (filter: OrderStatusFilter) => {
    setActiveFilter(filter);
    // Update URL without reload
    navigateToScreen({ ...navParams, filter: filter !== 'ALL' ? filter : null });
  };

  const handleRefundRequest = async (orderId: string, amount: number, reason: string) => {
    const params = new URLSearchParams({ token });
    applyLocaleToSearchParams(params, locale);
    const res = await fetch(`/api/orders/${orderId}/refund-request?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, reason }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || text.refundRequestFailed);
    }

    await loadOrders(page, pageSize);
  };

  const handleGoHome = () => {
    navigateToScreen({ ...navParams, screen: 'home', filter: null, page: null, page_size: null });
  };

  const filteredOrders = activeFilter === 'ALL' ? orders : orders.filter((o) => o.status === activeFilter);

  if (isMobile && !isEmbedded) {
    return (
      <div suppressHydrationWarning className={`flex min-h-screen items-center justify-center p-4 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!token && !resolvedUserId) {
    return (
      <div suppressHydrationWarning className={`flex min-h-screen items-center justify-center p-4 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="text-center text-red-500">
          <p className="text-lg font-medium">{text.missingAuth}</p>
          <p className={`mt-2 text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{text.visitOrders}</p>
        </div>
      </div>
    );
  }

  return (
    <PayPageLayout
      isDark={isDark}
      isEmbedded={isEmbedded}
      backHref={undefined}
      title={text.myOrders}
      subtitle={userInfo?.username || text.myOrders}
      actions={
        <button
          type="button"
          onClick={handleGoHome}
          className={[
            'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
            isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200',
          ].join(' ')}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      }
    >
      <OrderSummaryCards isDark={isDark} locale={locale} summary={summary} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <OrderFilterBar isDark={isDark} locale={locale} activeFilter={activeFilter} onChange={handleFilterChange} />
      </div>

      <OrderTable
        isDark={isDark}
        locale={locale}
        loading={loading}
        error={error}
        orders={filteredOrders}
        userBalance={userInfo?.balance ?? 0}
        onRefundRequest={async (orderId, amount, reason) => {
          try {
            await handleRefundRequest(orderId, amount, reason);
          } catch (err) {
            setError(err instanceof Error ? err.message : text.refundRequestFailed);
          }
        }}
      />

      <PaginationBar
        page={page}
        totalPages={totalPages}
        total={summary.total}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        locale={locale}
        isDark={isDark}
        loading={loading}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </PayPageLayout>
  );
}
