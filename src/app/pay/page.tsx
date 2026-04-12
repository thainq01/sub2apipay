'use client';

import { useSearchParams, notFound } from 'next/navigation';
import { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useThemeStore, hydrateTheme } from '@/stores/theme';
import PaymentForm from '@/components/PaymentForm';
import PaymentQRCode from '@/components/PaymentQRCode';
import OrderStatus from '@/components/OrderStatus';
import PayPageLayout from '@/components/PayPageLayout';
import MobileOrderList from '@/components/MobileOrderList';
import PurchaseFlow from '@/components/PurchaseFlow';
import PendingOrderBanner from '@/components/PendingOrderBanner';
import { resolveLocale, pickLocaleText, applyLocaleToSearchParams } from '@/lib/locale';
import { detectDeviceIsMobile, applySublabelOverrides, type UserInfo, type MyOrder } from '@/lib/pay-utils';
import type { PublicOrderStatusSnapshot } from '@/lib/order/status';
import type { MethodLimitInfo } from '@/components/PaymentForm';

interface OrderResult {
  orderId: string;
  amount: number;
  payAmount?: number;
  status: string;
  paymentType: string;
  payUrl?: string | null;
  qrCode?: string | null;
  clientSecret?: string | null;
  expiresAt: string;
  statusAccessToken: string;
  sepayBankInfo?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    transferCode: string;
  } | null;
}

interface AppConfig {
  enabledPaymentTypes: string[];
  minAmount: number;
  maxAmount: number;
  maxDailyAmount: number;
  methodLimits?: Record<string, MethodLimitInfo>;
  helpImageUrl?: string | null;
  helpText?: string | null;
  stripePublishableKey?: string | null;
  balanceDisabled?: boolean;
  maxPendingOrders?: number;
}

function PayContent() {
  const searchParams = useSearchParams();
  const token = (searchParams.get('token') || '').trim();
  const themeParam = searchParams.get('theme');
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const uiMode = searchParams.get('ui_mode') || 'standalone';
  const tab = searchParams.get('tab');
  const srcHost = searchParams.get('src_host') || undefined;
  const srcUrl = searchParams.get('src_url') || undefined;
  const locale = resolveLocale(searchParams.get('lang'));
  const autoAmount = searchParams.get('amount') ? Number(searchParams.get('amount')) : null;
  const resumeOrderId = searchParams.get('resume_order');

  useEffect(() => {
    hydrateTheme(themeParam);
  }, [themeParam]);

  const [isIframeContext, setIsIframeContext] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [step, setStep] = useState<'form' | 'paying' | 'result'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [subscriptionError, setSubscriptionError] = useState('');
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [finalOrderState, setFinalOrderState] = useState<PublicOrderStatusSnapshot | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [resolvedUserId, setResolvedUserId] = useState<number | null>(null);
  const [myOrders, setMyOrders] = useState<MyOrder[]>([]);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersHasMore, setOrdersHasMore] = useState(false);
  const [ordersLoadingMore, setOrdersLoadingMore] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'pay' | 'orders'>('pay');
  const [pendingCount, setPendingCount] = useState(0);

  // New state
  const [userLoaded, setUserLoaded] = useState(false);

  const [config, setConfig] = useState<AppConfig>({
    enabledPaymentTypes: [],
    minAmount: 1,
    maxAmount: 1000,
    maxDailyAmount: 0,
  });
  const [userNotFound, setUserNotFound] = useState(false);
  const [helpImageOpen, setHelpImageOpen] = useState(false);
  const autoSubmitTriggered = useRef(false);

  const hasToken = token.length > 0;
  const isEmbedded = uiMode === 'embedded' && isIframeContext;
  const helpImageUrl = (config.helpImageUrl || '').trim();
  const helpText = (config.helpText || '').trim();
  const hasHelpContent = Boolean(helpImageUrl || helpText);

  // Generic help/customer service information block
  const renderHelpSection = () => {
    if (!hasHelpContent) return null;
    return (
      <div
        className={[
          'mt-6 rounded-2xl border p-4',
          isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-slate-50',
        ].join(' ')}
      >
        <div className={['text-xs font-medium', isDark ? 'text-slate-400' : 'text-slate-500'].join(' ')}>
          {pickLocaleText(locale, 'Trợ giúp', 'Support')}
        </div>
        {helpImageUrl && (
          <img
            src={helpImageUrl}
            alt="help"
            onClick={() => setHelpImageOpen(true)}
            className={`mt-3 max-h-40 w-full cursor-zoom-in rounded-lg object-contain p-2 ${isDark ? 'bg-slate-700/50' : 'bg-white/70'}`}
          />
        )}
        {helpText && (
          <div className={['mt-3 space-y-1 text-sm leading-6', isDark ? 'text-slate-300' : 'text-slate-600'].join(' ')}>
            {helpText.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}
      </div>
    );
  };


  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsIframeContext(window.self !== window.top);
    setIsMobile(detectDeviceIsMobile());
  }, []);

  useEffect(() => {
    if (!isMobile || step !== 'form') return;
    if (tab === 'orders') {
      setActiveMobileTab('orders');
      return;
    }
    setActiveMobileTab('pay');
  }, [isMobile, step, tab]);

  const loadUserAndOrders = useCallback(async () => {
    if (!token) return;
    setUserNotFound(false);
    try {
      const meRes = await fetch(`/api/orders/my?token=${encodeURIComponent(token)}`);
      if (!meRes.ok) {
        setUserNotFound(true);
        return;
      }

      const meData = await meRes.json();
      const meUser = meData.user || {};
      const meId = Number(meUser.id);
      if (!Number.isInteger(meId) || meId <= 0) {
        setUserNotFound(true);
        return;
      }

      setResolvedUserId(meId);
      setPendingCount(meData.summary?.pending ?? 0);

      setUserInfo({
        id: meId,
        username:
          (typeof meUser.displayName === 'string' && meUser.displayName.trim()) ||
          (typeof meUser.username === 'string' && meUser.username.trim()) ||
          pickLocaleText(locale, `Người dùng #${meId}`, `User #${meId}`),
        balance: typeof meUser.balance === 'number' ? meUser.balance : undefined,
      });

      if (Array.isArray(meData.orders)) {
        setMyOrders(meData.orders);
        setOrdersPage(1);
        setOrdersHasMore((meData.total_pages ?? 1) > 1);
      } else {
        setMyOrders([]);
        setOrdersPage(1);
        setOrdersHasMore(false);
      }

      const cfgRes = await fetch(`/api/user?user_id=${meId}&token=${encodeURIComponent(token)}`);
      if (cfgRes.ok) {
        const cfgData = await cfgRes.json();
        if (cfgData.config) {
          setConfig({
            enabledPaymentTypes: cfgData.config.enabledPaymentTypes ?? ['sepay'],
            minAmount: cfgData.config.minAmount ?? 1,
            maxAmount: cfgData.config.maxAmount ?? 1000,
            maxDailyAmount: cfgData.config.maxDailyAmount ?? 0,
            methodLimits: cfgData.config.methodLimits,
            helpImageUrl: cfgData.config.helpImageUrl ?? null,
            helpText: cfgData.config.helpText ?? null,
            stripePublishableKey: cfgData.config.stripePublishableKey ?? null,
            balanceDisabled: cfgData.config.balanceDisabled ?? false,
            maxPendingOrders: cfgData.config.maxPendingOrders ?? 3,
          });
          if (cfgData.config.sublabelOverrides) {
            applySublabelOverrides(cfgData.config.sublabelOverrides);
          }
        }
      }
    } catch {
    } finally {
      setUserLoaded(true);
    }
  }, [token, locale]);

  const loadMoreOrders = async () => {
    if (!token || ordersLoadingMore || !ordersHasMore) return;
    const nextPage = ordersPage + 1;
    setOrdersLoadingMore(true);
    try {
      const res = await fetch(`/api/orders/my?token=${encodeURIComponent(token)}&page=${nextPage}&page_size=20`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.orders) && data.orders.length > 0) {
        setMyOrders((prev) => [...prev, ...data.orders]);
        setOrdersPage(nextPage);
        setOrdersHasMore(nextPage < (data.total_pages ?? 1));
      } else {
        setOrdersHasMore(false);
      }
    } catch {
    } finally {
      setOrdersLoadingMore(false);
    }
  };

  useEffect(() => {
    loadUserAndOrders();
  }, [loadUserAndOrders]);

  // Auto-submit when amount param is provided and config is loaded
  useEffect(() => {
    if (
      autoAmount &&
      autoAmount > 0 &&
      userLoaded &&
      config.enabledPaymentTypes.length > 0 &&
      step === 'form' &&
      !autoSubmitTriggered.current &&
      !loading
    ) {
      autoSubmitTriggered.current = true;
      const paymentType = config.enabledPaymentTypes[0];
      handleSubmit(autoAmount, paymentType);
    }
  }, [autoAmount, userLoaded, config.enabledPaymentTypes, step, loading]);

  // Resume order flow
  useEffect(() => {
    if (!resumeOrderId || !userLoaded) return;

    const resumeOrder = async () => {
      try {
        const res = await fetch(`/api/orders/resume?token=${encodeURIComponent(token)}&order_id=${encodeURIComponent(resumeOrderId)}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          setError(errData.error || pickLocaleText(locale, 'Không thể lấy thông tin đơn hàng', 'Failed to retrieve order information'));
          return;
        }

        const data = await res.json();
        setOrderResult({
          orderId: data.orderId,
          amount: data.amount,
          payAmount: data.payAmount,
          status: data.status,
          paymentType: data.paymentType,
          expiresAt: data.expiresAt,
          statusAccessToken: data.statusAccessToken,
          qrCode: data.qrCode,
          sepayBankInfo: data.sepayBankInfo,
        });
        setStep('paying');
      } catch {
        setError(pickLocaleText(locale, 'Lỗi mạng', 'Network error'));
      }
    };

    resumeOrder();
  }, [resumeOrderId, userLoaded, token, locale]);

  useEffect(() => {
    if (step !== 'result' || finalOrderState?.status !== 'COMPLETED') return;
    loadUserAndOrders();
    const timer = setTimeout(() => {
      setStep('form');
      setOrderResult(null);
      setFinalOrderState(null);
      setError('');
      setSubscriptionError('');
    }, 2200);
    return () => clearTimeout(timer);
  }, [step, finalOrderState, loadUserAndOrders]);

  // Check after order completion if subscription group has been removed
  useEffect(() => {
    if (step !== 'result' || !finalOrderState) return;
    if (finalOrderState.status === 'FAILED' && finalOrderState.failedReason?.includes('SUBSCRIPTION_GROUP_GONE')) {
      setSubscriptionError(
        pickLocaleText(
          locale,
          'Thanh toán thành công, nhưng nhóm đăng ký đã bị xóa. Vui lòng liên hệ hỗ trợ với ID đơn hàng của bạn.',
          'Payment successful, but the subscription group has been removed. Please contact support with your order ID.',
        ),
      );
    }
  }, [step, finalOrderState, locale]);

  if (!hasToken) {
    notFound();
  }

  if (userNotFound) {
    return (
      <div suppressHydrationWarning className={`flex min-h-screen items-center justify-center p-4 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="text-center text-red-500">
          <p className="text-lg font-medium">{pickLocaleText(locale, 'Người dùng không tồn tại', 'User not found')}</p>
          <p className={`mt-2 text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            {pickLocaleText(
              locale,
              'Vui lòng kiểm tra liên kết có chính xác không hoặc liên hệ với quản trị viên',
              'Please check whether the link is correct or contact the administrator',
            )}
          </p>
        </div>
      </div>
    );
  }

  const buildScopedUrl = (path: string, forceOrdersTab = false) => {
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (themeParam) params.set('theme', themeParam);
    params.set('ui_mode', uiMode);
    if (forceOrdersTab) params.set('tab', 'orders');
    if (srcHost) params.set('src_host', srcHost);
    if (srcUrl) params.set('src_url', srcUrl);
    applyLocaleToSearchParams(params, locale);
    return `${path}?${params.toString()}`;
  };

  const buildHomeUrl = () => {
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    applyLocaleToSearchParams(params, locale);
    return `/home?${params.toString()}`;
  };

  const pcOrdersUrl = buildScopedUrl('/pay/orders');
  const mobileOrdersUrl = buildScopedUrl('/pay', true);
  const ordersUrl = isMobile ? mobileOrdersUrl : pcOrdersUrl;

  // ── Balance recharge submission ──
  const handleSubmit = async (amount: number, paymentType: string) => {

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          amount,
          payment_type: paymentType,
          is_mobile: isMobile,
          src_host: srcHost,
          src_url: srcUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Cancel rate limiting: construct internationalized prompt based on structured backend response
        if (data.code === 'CANCEL_RATE_LIMITED' && data.data) {
          const { windowSize, unit, maxCount, retryAfterMinutes } = data.data as {
            windowSize: number;
            unit: string;
            maxCount: number;
            retryAfterMinutes: number;
          };
          const unitLabel = pickLocaleText(
            locale,
            unit === 'minute' ? 'phút' : unit === 'day' ? 'ngày' : 'giờ',
            unit === 'minute' ? 'minute(s)' : unit === 'day' ? 'day(s)' : 'hour(s)',
          );
          let waitLabel: string;
          if (retryAfterMinutes < 60) {
            waitLabel = pickLocaleText(locale, `${retryAfterMinutes} phút`, `${retryAfterMinutes} minute(s)`);
          } else {
            const hours = Math.ceil(retryAfterMinutes / 60);
            waitLabel = pickLocaleText(locale, `${hours} giờ`, `${hours} hour(s)`);
          }
          setError(
            pickLocaleText(
              locale,
              `Hủy đơn quá thường xuyên (tối đa ${maxCount} trên ${windowSize} ${unitLabel}). Bạn có thể đặt đơn mới trong ${waitLabel}`,
              `Too many cancellations (max ${maxCount} per ${windowSize} ${unitLabel}). You can place a new order in ${waitLabel}`,
            ),
          );
          return;
        }

        const codeMessages: Record<string, string> = {
          INVALID_TOKEN: pickLocaleText(locale, 'Xác thực đã hết hạn', 'Authentication expired'),
          USER_INACTIVE: pickLocaleText(locale, 'Tài khoản bị vô hiệu hóa', 'Account is disabled'),
          TOO_MANY_PENDING: pickLocaleText(locale, 'Quá nhiều đơn chưa thanh toán', 'Too many pending orders'),
          USER_NOT_FOUND: pickLocaleText(locale, 'Người dùng không tồn tại', 'User not found'),
          NO_AVAILABLE_INSTANCE: pickLocaleText(
            locale,
            'Không có kênh thanh toán nào khả dụng, vui lòng thử lại sau hoặc sử dụng phương thức khác',
            'No available payment instance, please try later or use another method',
          ),
          DAILY_LIMIT_EXCEEDED: data.error,
          METHOD_DAILY_LIMIT_EXCEEDED: data.error,
          PAYMENT_GATEWAY_ERROR: data.error,
        };
        setError(
          codeMessages[data.code] || data.error || pickLocaleText(locale, 'Lỗi tạo đơn hàng', 'Failed to create order'),
        );
        return;
      }

      setOrderResult({
        orderId: data.orderId,
        amount: data.amount,
        payAmount: data.payAmount,
        status: data.status,
        paymentType: data.paymentType || paymentType,
        payUrl: data.payUrl,
        qrCode: data.qrCode,
        clientSecret: data.clientSecret,
        expiresAt: data.expiresAt,
        statusAccessToken: data.statusAccessToken,
        sepayBankInfo: data.sepayBankInfo,
      });
      setStep('paying');
    } catch {
      setError(pickLocaleText(locale, 'Lỗi mạng', 'Network error'));
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (order: PublicOrderStatusSnapshot) => {
    setFinalOrderState(order);
    setStep('result');
    if (isMobile) setActiveMobileTab('orders');
  };

  const handleBack = () => {
    setStep('form');
    setOrderResult(null);
    setFinalOrderState(null);
    setError('');
    setSubscriptionError('');
  };

  // ── Render ──
  const pageTitle = pickLocaleText(locale, 'Nạp tiền tài khoản', 'Top Up Your Balance');
  const pageSubtitle = pickLocaleText(locale, 'Nạp tiền và sử dụng theo nhu cầu', 'Pay as you go — top up and use');

  return (
    <PayPageLayout
      isDark={isDark}
      isEmbedded={isEmbedded}
      isIframe={isIframeContext}
      title={pageTitle}
      subtitle={pageSubtitle}
      backHref={buildHomeUrl()}
      locale={locale}
    >
      {/* Subscription group removal persistent error */}
      {subscriptionError && (
        <div
          className={[
            'mb-4 rounded-lg border-2 p-4 text-sm',
            isDark ? 'border-red-600 bg-red-900/40 text-red-300' : 'border-red-400 bg-red-50 text-red-700',
          ].join(' ')}
        >
          <div className="font-semibold mb-1">{pickLocaleText(locale, 'Đăng ký thất bại', 'Subscription Failed')}</div>
          <div>{subscriptionError}</div>
          {orderResult && (
            <div className="mt-2 text-xs opacity-80">
              {pickLocaleText(locale, 'Mã đơn hàng', 'Order ID')}: {orderResult.orderId}
            </div>
          )}
        </div>
      )}

      {error && (
        <div
          className={[
            'mb-4 rounded-lg border p-3 text-sm',
            isDark ? 'border-red-700 bg-red-900/30 text-red-400' : 'border-red-200 bg-red-50 text-red-600',
          ].join(' ')}
        >
          {error}
        </div>
      )}

      {/* ── Form phase ── */}
      {step === 'form' && (
        <>
          {/* Pending order notification */}
          <PendingOrderBanner orders={myOrders} dark={isDark} locale={locale} buildPayUrl={(orderId) => {
            const params = new URLSearchParams();
            if (token) params.set('token', token);
            params.set('resume_order', orderId);
            return `/pay?${params.toString()}`;
          }} />

          {/* Loading */}
          {!userLoaded && (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <span className={['ml-3 text-sm', isDark ? 'text-slate-400' : 'text-gray-500'].join(' ')}>
                {pickLocaleText(locale, 'Đang tải...', 'Loading...')}
              </span>
            </div>
          )}

          {userLoaded && (
            <>
              {/* Pay-as-you-go explanation banner */}
              <div
                className={[
                  'mb-6 rounded-2xl border p-6',
                  isDark
                    ? 'border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-purple-500/10'
                    : 'border-emerald-500/20 bg-gradient-to-r from-emerald-50 to-purple-50',
                ].join(' ')}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={[
                      'flex-shrink-0 rounded-lg p-2',
                      isDark ? 'bg-emerald-500/20' : 'bg-emerald-500/15',
                    ].join(' ')}
                  >
                    <svg
                      className="h-6 w-6 text-emerald-500"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3
                      className={[
                        'text-lg font-semibold mb-2',
                        isDark ? 'text-emerald-400' : 'text-emerald-700',
                      ].join(' ')}
                    >
                      {pickLocaleText(locale, 'Chế độ trả tiền theo cách sử dụng', 'Pay-as-you-go')}
                    </h3>
                    <p className={['text-sm mb-4', isDark ? 'text-slate-400' : 'text-slate-500'].join(' ')}>
                      {pickLocaleText(
                        locale,
                        'Không cần đăng ký, nạp tiền và sử dụng. Tính phí theo mức sử dụng thực tế. Số dư hoạt động trên tất cả các kênh. Giá tính bằng USD',
                        'No subscription needed. Top up and use. Charged by actual usage. Balance works across all channels. Priced in USD',
                      )}
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div
                        className={['flex items-center gap-2', isDark ? 'text-slate-400' : 'text-slate-500'].join(' ')}
                      >
                        <svg
                          className="h-4 w-4 text-green-500"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                          <polyline points="17 6 23 6 23 12" />
                        </svg>
                        <span>{pickLocaleText(locale, 'Tỷ lệ càng thấp càng tốt', 'Lower rate = better value')}</span>
                      </div>
                      <div
                        className={['flex items-center gap-2', isDark ? 'text-slate-400' : 'text-slate-500'].join(' ')}
                      >
                        <svg
                          className="h-4 w-4 text-blue-500"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <span>
                          {pickLocaleText(
                            locale,
                            '0.15 tỷ lệ = 1 USD ≈ 23,500 VND hạn mức',
                            '0.15 rate = 1 USD ≈ 23,500 VND quota',
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment form */}
              <PaymentForm
                userId={resolvedUserId ?? 0}
                userName={userInfo?.username}
                userBalance={userInfo?.balance}
                enabledPaymentTypes={config.enabledPaymentTypes}
                methodLimits={config.methodLimits}
                minAmount={config.minAmount}
                maxAmount={config.maxAmount}
                onSubmit={handleSubmit}
                loading={loading}
                dark={isDark}
                locale={locale}
              />

              {renderHelpSection()}

              <div className="mt-8">
                <PurchaseFlow isDark={isDark} locale={locale} />
              </div>
            </>
          )}
        </>
      )}

      {/* ── Payment phase ── */}
      {step === 'paying' && orderResult && (
        <>
          <PaymentQRCode
            orderId={orderResult.orderId}
            token={token || undefined}
            qrCode={orderResult.qrCode}
            paymentType={orderResult.paymentType}
            amount={orderResult.amount}
            payAmount={orderResult.payAmount}
            expiresAt={orderResult.expiresAt}
            statusAccessToken={orderResult.statusAccessToken}
            onStatusChange={handleStatusChange}
            onBack={handleBack}
            dark={isDark}
            isMobile={isMobile}
            locale={locale}
            isIframe={isIframeContext}
            sepayBankInfo={orderResult.sepayBankInfo}
          />
          {renderHelpSection()}
        </>
      )}

      {/* ── Result phase ── */}
      {step === 'result' && orderResult && finalOrderState && (
        <OrderStatus
          orderId={orderResult.orderId}
          order={finalOrderState}
          statusAccessToken={orderResult.statusAccessToken}
          onStateChange={setFinalOrderState}
          onBack={handleBack}
          dark={isDark}
          locale={locale}
        />
      )}

      {/* Help image zoom */}
      {helpImageOpen && helpImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setHelpImageOpen(false)}
        >
          <img
            src={helpImageUrl}
            alt="help"
            className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </PayPageLayout>
  );
}

function PayPageFallback() {
  const searchParams = useSearchParams();
  const locale = resolveLocale(searchParams.get('lang'));
  const isDark = searchParams.get('theme') === 'dark';
  return (
    <div suppressHydrationWarning className={`flex min-h-screen items-center justify-center ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className={isDark ? 'text-slate-400' : 'text-gray-500'}>
        {pickLocaleText(locale, 'Đang tải...', 'Loading...')}
      </div>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={<PayPageFallback />}>
      <PayContent />
    </Suspense>
  );
}
