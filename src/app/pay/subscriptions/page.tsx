'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useThemeStore, hydrateTheme } from '@/stores/theme';
import PayPageLayout from '@/components/PayPageLayout';
import SubscriptionPlanCard, { type PlanInfo } from '@/components/SubscriptionPlanCard';
import SubscriptionConfirm from '@/components/SubscriptionConfirm';
import PaymentQRCode from '@/components/PaymentQRCode';
import { resolveLocale, pickLocaleText, type Locale } from '@/lib/locale';
import type { PublicOrderStatusSnapshot } from '@/lib/order/status';

type PaymentStep = 'selecting' | 'paying' | 'success';

interface OrderResult {
  orderId: string;
  amount: number;
  payAmount?: number;
  expiresAt: string;
  qrCode?: string;
  statusAccessToken?: string;
  sepayBankInfo?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    transferCode: string;
  } | null;
}
import { PlatformBadge } from '@/lib/platform-style';

interface ActiveSubscription {
  id: number;
  groupId: number;
  groupName: string | null;
  platform: string | null;
  startsAt: string;
  expiresAt: string;
  status: string;
}

function SubscriptionsContent() {
  const searchParams = useSearchParams();
  const token = (searchParams.get('token') || '').trim();
  const resumeOrderId = searchParams.get('resume_order');
  const themeParam = searchParams.get('theme');
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const uiMode = searchParams.get('ui_mode') || 'standalone';
  const locale = resolveLocale(searchParams.get('lang'));

  useEffect(() => {
    hydrateTheme(themeParam);
  }, [themeParam]);

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
        fetch(`/api/user?token=${encodeURIComponent(token)}`),
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
        // Fallback to sepay if user fetch fails
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
        const res = await fetch(`/api/orders/resume?token=${encodeURIComponent(token)}&order_id=${encodeURIComponent(resumeOrderId)}`);
        if (res.ok) {
          const data = await res.json();
          setOrderResult({
            orderId: data.orderId,
            amount: data.amount,
            payAmount: data.payAmount,
            expiresAt: data.expiresAt,
            qrCode: data.qrCode,
            statusAccessToken: data.statusAccessToken,
            sepayBankInfo: data.sepayBankInfo,
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

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          amount: selectedPlan.price,
          payment_type: paymentType,
          order_type: 'subscription',
          plan_id: selectedPlan.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t.orderFailed);
      }

      // Store order result and display QR inline
      setOrderResult({
        orderId: data.orderId,
        amount: data.amount,
        payAmount: data.payAmount,
        expiresAt: data.expiresAt,
        qrCode: data.qrCode,
        statusAccessToken: data.statusAccessToken,
        sepayBankInfo: data.sepayBankInfo,
      });
      setPaymentStep('paying');
      setSubmitting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.orderFailed);
      setSubmitting(false);
    }
  };

  const buildHomeUrl = () => {
    const params = new URLSearchParams();
    params.set('token', token);
    if (themeParam) params.set('theme', themeParam);
    if (locale !== 'vi') params.set('lang', locale);
    return `/home?${params.toString()}`;
  };

  const handlePaymentBack = () => {
    // If resumed from home, go back to home instead of showing subscription list
    if (resumeOrderId) {
      window.location.href = buildHomeUrl();
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
          window.location.href = buildHomeUrl();
        }
      }, 2000);
    } else if (status.status === 'CANCELLED' || status.status === 'EXPIRED') {
      // If resumed from home, go back to home
      if (resumeOrderId) {
        window.location.href = buildHomeUrl();
        return;
      }
      setPaymentStep('selecting');
      setOrderResult(null);
    }
  };

  if (!token) {
    return (
      <div className={['flex min-h-screen items-center justify-center p-4', isDark ? 'bg-slate-950' : 'bg-slate-50'].join(' ')}>
        <div className="text-center text-red-500">
          <p className="text-lg font-medium">{t.missingToken}</p>
        </div>
      </div>
    );
  }

  return (
    <PayPageLayout
      isDark={isDark}
      isEmbedded={uiMode === 'embedded'}
      title={t.title}
      subtitle={t.subtitle}
      backHref={buildHomeUrl()}
      locale={locale}
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
            amount={orderResult.amount}
            payAmount={orderResult.payAmount}
            expiresAt={orderResult.expiresAt}
            statusAccessToken={orderResult.statusAccessToken}
            onStatusChange={handlePaymentStatusChange}
            onBack={handlePaymentBack}
            dark={isDark}
            isIframe={uiMode === 'embedded'}
            locale={locale}
            orderType="subscription"
            sepayBankInfo={orderResult.sepayBankInfo}
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

function SubscriptionsPageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>
  );
}

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={<SubscriptionsPageFallback />}>
      <SubscriptionsContent />
    </Suspense>
  );
}
