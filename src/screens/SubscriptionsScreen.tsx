'use client';

import { useState, useEffect, useCallback } from 'react';
import { useThemeStore } from '@/stores/theme';
import PayPageLayout from '@/components/PayPageLayout';
import SubscriptionPlanCard, { type PlanInfo } from '@/components/SubscriptionPlanCard';
import SubscriptionConfirm from '@/components/SubscriptionConfirm';
import PaymentQRCode from '@/components/PaymentQRCode';
import { resolveLocale, pickLocaleText, type Locale } from '@/lib/locale';
import { navigateToScreen, type ScreenNavParams } from '@/lib/screen-nav';
import type { PublicOrderStatusSnapshot } from '@/lib/order/status';
import { PlatformBadge } from '@/lib/platform-style';

type PaymentStep = 'selecting' | 'paying' | 'success';

interface OrderResult {
  orderId: string;
  amount: number;
  payAmount?: number;
  expiresAt: string;
  qrCode?: string;
  statusAccessToken?: string;
  paymentType?: string;
  sepayBankInfo?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    transferCode: string;
  } | null;
  bscPaymentInfo?: {
    walletAddress: string;
    network: string;
    tokenName: string;
    usdtAmount: string;
  } | null;
}

interface ActiveSubscription {
  id: number;
  groupId: number;
  groupName: string | null;
  platform: string | null;
  startsAt: string;
  expiresAt: string;
  status: string;
}

interface SubscriptionsScreenProps {
  token: string;
  isIframe: boolean;
  navParams: ScreenNavParams;
}

export default function SubscriptionsScreen({ token, isIframe, navParams }: SubscriptionsScreenProps) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const locale = resolveLocale(navParams.lang);
  const resumeOrderId = navParams.resume_order;

  const isEmbedded = navParams.ui_mode === 'embedded' || isIframe;

  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [activeSubs, setActiveSubs] = useState<ActiveSubscription[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PlanInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [paymentStep, setPaymentStep] = useState<PaymentStep>(resumeOrderId ? 'paying' : 'selecting');

  const t = buildText(locale);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');

    try {
      const [plansRes, subsRes, userRes] = await Promise.all([
        fetch(`/api/subscription-plans?token=${encodeURIComponent(token)}`),
        fetch(`/api/user/subscriptions?token=${encodeURIComponent(token)}`),
        (() => {
          // Extract user_id from JWT payload for the /api/user call
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return fetch(`/api/user?user_id=${payload.user_id}&token=${encodeURIComponent(token)}`);
          } catch {
            return fetch(`/api/user?token=${encodeURIComponent(token)}`);
          }
        })(),
      ]);

      if (plansRes.ok) {
        const data = await plansRes.json();
        setPlans(data.plans || []);
      } else {
        throw new Error(t.loadPlansFailed);
      }

      if (subsRes.ok) {
        const data = await subsRes.json();
        setActiveSubs(data.subscriptions || []);
      }

      if (userRes.ok) {
        const userData = await userRes.json();
        if (userData.config?.enabledPaymentTypes && userData.config.enabledPaymentTypes.length > 0) {
          setPaymentTypes(userData.config.enabledPaymentTypes);
        } else {
          setPaymentTypes(['sepay']);
        }
      } else {
        setPaymentTypes(['sepay']);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [token, t.loadPlansFailed, t.loadFailed]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Resume pending order if resume_order param is provided
  useEffect(() => {
    if (!resumeOrderId || !token) return;

    const resumeOrder = async () => {
      try {
        const res = await fetch(
          `/api/orders/resume?token=${encodeURIComponent(token)}&order_id=${encodeURIComponent(resumeOrderId)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setOrderResult({
            orderId: data.orderId,
            amount: data.amount,
            payAmount: data.payAmount,
            expiresAt: data.expiresAt,
            qrCode: data.qrCode,
            statusAccessToken: data.statusAccessToken,
            paymentType: data.paymentType,
            sepayBankInfo: data.sepayBankInfo,
            bscPaymentInfo: data.bscPaymentInfo,
          });
          setPaymentStep('paying');
          setLoading(false);
        }
      } catch {}
    };

    resumeOrder();
  }, [resumeOrderId, token]);

  const handleSubscribe = (planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    if (plan) {
      setSelectedPlan(plan);
    }
  };

  const handleBack = () => {
    setSelectedPlan(null);
  };

  const handleSubmit = async (paymentType: string) => {
    if (!selectedPlan || submitting) return;

    setSubmitting(true);
    setError('');

    // For bsc-usdt: send the plan's USDT price directly
    const orderAmount =
      paymentType === 'bsc-usdt' && selectedPlan.priceUsdt !== null ? selectedPlan.priceUsdt : selectedPlan.price;

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          amount: orderAmount,
          payment_type: paymentType,
          order_type: 'subscription',
          plan_id: selectedPlan.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t.orderFailed);
      }

      setOrderResult({
        orderId: data.orderId,
        amount: data.amount,
        payAmount: data.payAmount,
        expiresAt: data.expiresAt,
        qrCode: data.qrCode,
        statusAccessToken: data.statusAccessToken,
        paymentType: data.paymentType,
        sepayBankInfo: data.sepayBankInfo,
        bscPaymentInfo: data.bscPaymentInfo,
      });
      setPaymentStep('paying');
      setSubmitting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.orderFailed);
      setSubmitting(false);
    }
  };

  const handleGoHome = () => {
    navigateToScreen({ ...navParams, screen: 'home', resume_order: null });
  };

  const handlePaymentBack = () => {
    // If resumed from home, go back to home instead of showing subscription list
    if (resumeOrderId) {
      handleGoHome();
      return;
    }
    setPaymentStep('selecting');
    setOrderResult(null);
  };

  const handlePaymentStatusChange = (status: PublicOrderStatusSnapshot) => {
    if (status.paymentSuccess) {
      setPaymentStep('success');
      // Refresh subscriptions after brief delay
      setTimeout(async () => {
        await fetchData();
        setSelectedPlan(null);
        setOrderResult(null);
        setPaymentStep('selecting');
        // If resumed from home, redirect to home after success
        if (resumeOrderId) {
          handleGoHome();
        }
      }, 2000);
    } else if (status.status === 'CANCELLED' || status.status === 'EXPIRED') {
      // If resumed from home, go back to home
      if (resumeOrderId) {
        handleGoHome();
        return;
      }
      setPaymentStep('selecting');
      setOrderResult(null);
    }
  };

  if (!token) {
    return (
      <div
        className={['flex min-h-screen items-center justify-center p-4', isDark ? 'bg-slate-950' : 'bg-slate-50'].join(
          ' ',
        )}
      >
        <div className="text-center text-red-500">
          <p className="text-lg font-medium">{t.missingToken}</p>
        </div>
      </div>
    );
  }

  return (
    <PayPageLayout
      isDark={isDark}
      isEmbedded={isEmbedded}
      title={t.title}
      subtitle={t.subtitle}
      backHref={undefined}
      locale={locale}
      actions={
        <button
          type="button"
          onClick={handleGoHome}
          className={[
            'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
            isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200',
          ].join(' ')}
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      }
    >
      {error && (
        <div
          className={[
            'mb-4 rounded-lg border p-3 text-sm',
            isDark ? 'border-red-800 bg-red-950/50 text-red-400' : 'border-red-200 bg-red-50 text-red-600',
          ].join(' ')}
        >
          {error}
          <button onClick={() => setError('')} className="ml-2 opacity-60 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : paymentStep === 'success' ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-4 py-8">
          <div className={isDark ? 'text-6xl text-green-400' : 'text-6xl text-green-600'}>{'✓'}</div>
          <h2 className={['text-xl font-bold', isDark ? 'text-green-400' : 'text-green-600'].join(' ')}>
            {t.paymentSuccess}
          </h2>
          <p className={['text-center text-sm', isDark ? 'text-slate-400' : 'text-gray-500'].join(' ')}>
            {t.subscriptionActivated}
          </p>
        </div>
      ) : paymentStep === 'paying' && orderResult ? (
        <PaymentQRCode
          orderId={orderResult.orderId}
          token={token}
          qrCode={orderResult.qrCode}
          paymentType={orderResult.paymentType}
          amount={orderResult.amount}
          payAmount={orderResult.payAmount}
          expiresAt={orderResult.expiresAt}
          statusAccessToken={orderResult.statusAccessToken}
          onStatusChange={handlePaymentStatusChange}
          onBack={handlePaymentBack}
          dark={isDark}
          isIframe={isEmbedded}
          locale={locale}
          orderType="subscription"
          sepayBankInfo={orderResult.sepayBankInfo}
          bscPaymentInfo={orderResult.bscPaymentInfo}
        />
      ) : selectedPlan ? (
        <SubscriptionConfirm
          plan={selectedPlan}
          paymentTypes={paymentTypes}
          onBack={handleBack}
          onSubmit={handleSubmit}
          loading={submitting}
          isDark={isDark}
          locale={locale}
        />
      ) : (
        <>
          {/* Active Subscriptions */}
          {activeSubs.length > 0 && (
            <div className="mb-6">
              <h2 className={['mb-3 text-sm font-medium', isDark ? 'text-slate-300' : 'text-slate-700'].join(' ')}>
                {t.activeSubscriptions}
              </h2>
              <div className="space-y-3">
                {activeSubs.map((sub) => (
                  <ActiveSubscriptionCard key={sub.id} subscription={sub} isDark={isDark} locale={locale} />
                ))}
              </div>
            </div>
          )}

          {/* Available Plans */}
          {plans.length > 0 ? (
            <div>
              <h2 className={['mb-3 text-sm font-medium', isDark ? 'text-slate-300' : 'text-slate-700'].join(' ')}>
                {t.availablePlans}
              </h2>
              <div className="space-y-4">
                {plans.map((plan) => {
                  const isAlreadySubscribed = activeSubs.some((sub) => sub.groupId === plan.groupId);
                  return (
                    <SubscriptionPlanCard
                      key={plan.id}
                      plan={plan}
                      onSubscribe={handleSubscribe}
                      isDark={isDark}
                      locale={locale}
                      disabled={isAlreadySubscribed}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div
              className={[
                'rounded-xl border py-12 text-center',
                isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50',
              ].join(' ')}
            >
              <div className={['text-sm', isDark ? 'text-slate-400' : 'text-slate-500'].join(' ')}>{t.noPlans}</div>
            </div>
          )}
        </>
      )}
    </PayPageLayout>
  );
}

function ActiveSubscriptionCard({
  subscription,
  isDark,
  locale,
}: {
  subscription: ActiveSubscription;
  isDark: boolean;
  locale: Locale;
}) {
  const expiresAt = new Date(subscription.expiresAt);
  const now = new Date();
  const remainingDays = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  const t = buildText(locale);

  return (
    <div
      className={[
        'rounded-xl border p-4',
        isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-white',
      ].join(' ')}
    >
      <div className="mb-2 flex items-center gap-2">
        {subscription.platform && <PlatformBadge platform={subscription.platform} />}
        <span className={['font-medium', isDark ? 'text-slate-200' : 'text-slate-800'].join(' ')}>
          {subscription.groupName || `Group #${subscription.groupId}`}
        </span>
      </div>
      <div className={['text-xs', isDark ? 'text-slate-400' : 'text-slate-500'].join(' ')}>
        {t.expiresIn}{' '}
        <span className={remainingDays <= 7 ? 'text-amber-500 font-medium' : ''}>
          {remainingDays} {t.days}
        </span>
      </div>
      <div className={['mt-1 text-xs', isDark ? 'text-slate-500' : 'text-slate-400'].join(' ')}>
        {expiresAt.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US')}
      </div>
    </div>
  );
}

function buildText(locale: Locale) {
  return locale === 'en'
    ? {
        missingToken: 'Missing token',
        title: 'Subscriptions',
        subtitle: 'Browse and purchase subscription plans',
        loading: 'Loading...',
        loadFailed: 'Failed to load data',
        loadPlansFailed: 'Failed to load subscription plans',
        orderFailed: 'Failed to create order',
        activeSubscriptions: 'Your Active Subscriptions',
        availablePlans: 'Available Plans',
        noPlans: 'No subscription plans available',
        expiresIn: 'Expires in',
        days: 'days',
        paymentSuccess: 'Payment Successful',
        subscriptionActivated: 'Your subscription has been activated!',
        backToConfirm: 'Back',
      }
    : {
        missingToken: 'Thiếu token',
        title: 'Gói đăng ký',
        subtitle: 'Xem và mua các gói đăng ký',
        loading: 'Đang tải...',
        loadFailed: 'Tải dữ liệu thất bại',
        loadPlansFailed: 'Tải gói đăng ký thất bại',
        orderFailed: 'Tạo đơn hàng thất bại',
        activeSubscriptions: 'Gói đang hoạt động',
        availablePlans: 'Gói có sẵn',
        noPlans: 'Không có gói đăng ký nào',
        expiresIn: 'Hết hạn trong',
        days: 'ngày',
        paymentSuccess: 'Thanh toán thành công',
        subscriptionActivated: 'Gói đăng ký của bạn đã được kích hoạt!',
        backToConfirm: 'Quay lại',
      };
}
