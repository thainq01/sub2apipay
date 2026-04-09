'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { applyLocaleToSearchParams, pickLocaleText, resolveLocale, type Locale } from '@/lib/locale';
import type { PublicOrderStatusSnapshot } from '@/lib/order/status';
import { buildOrderStatusUrl } from '@/lib/order/status-url';

type WindowWithAlipayBridge = Window & {
  AlipayJSBridge?: {
    call: (name: string, params?: unknown, callback?: (...args: unknown[]) => void) => void;
  };
};

function tryCloseViaAlipayBridge(): boolean {
  const bridge = (window as WindowWithAlipayBridge).AlipayJSBridge;
  if (!bridge?.call) {
    return false;
  }

  try {
    bridge.call('closeWebview');
    return true;
  } catch {
    return false;
  }
}

function closeCurrentWindow() {
  if (tryCloseViaAlipayBridge()) {
    return;
  }

  let settled = false;
  const handleBridgeReady = () => {
    if (settled) {
      return;
    }
    settled = true;
    document.removeEventListener('AlipayJSBridgeReady', handleBridgeReady);
    if (!tryCloseViaAlipayBridge()) {
      window.close();
    }
  };

  document.addEventListener('AlipayJSBridgeReady', handleBridgeReady, { once: true });
  window.setTimeout(() => {
    if (settled) {
      return;
    }
    settled = true;
    document.removeEventListener('AlipayJSBridgeReady', handleBridgeReady);
    window.close();
  }, 250);
}

function getStatusConfig(
  order: PublicOrderStatusSnapshot | null,
  locale: Locale,
  hasAccessToken: boolean,
  isDark = false,
) {
  if (!order) {
    return locale === 'en'
      ? {
          label: 'Payment Error',
          color: isDark ? 'text-red-400' : 'text-red-600',
          icon: '✗',
          message: hasAccessToken
            ? 'Unable to load the order status. Please try again later.'
            : 'Missing order access token. Please go back to the recharge page.',
        }
      : {
          label: 'Payment Error',
          color: isDark ? 'text-red-400' : 'text-red-600',
          icon: '✗',
          message: hasAccessToken ? 'Unable to load the order status. Please try again later.' : 'Missing order access token. Please go back to the recharge page.',
        };
  }

  if (order.rechargeSuccess) {
    return locale === 'en'
      ? {
          label: 'Recharge Successful',
          color: isDark ? 'text-green-400' : 'text-green-600',
          icon: '✓',
          message: 'Your balance has been credited successfully.',
        }
      : {
          label: 'Recharge Successful',
          color: isDark ? 'text-green-400' : 'text-green-600',
          icon: '✓',
          message: 'Your balance has been credited successfully.',
        };
  }

  if (order.paymentSuccess) {
    if (order.rechargeStatus === 'paid_pending' || order.rechargeStatus === 'recharging') {
      return locale === 'en'
        ? {
            label: 'Top-up Processing',
            color: isDark ? 'text-blue-400' : 'text-blue-600',
            icon: '⟳',
            message: 'Payment succeeded, and the balance top-up is being processed.',
          }
        : {
            label: 'Top-up Processing',
            color: isDark ? 'text-blue-400' : 'text-blue-600',
            icon: '⟳',
            message: 'Payment succeeded, and the balance top-up is being processed.',
          };
    }

    if (order.rechargeStatus === 'failed') {
      return locale === 'en'
        ? {
            label: 'Payment Successful',
            color: isDark ? 'text-amber-400' : 'text-amber-600',
            icon: '!',
            message:
              'Payment succeeded, but the balance top-up has not completed yet. Please check again later or contact the administrator.',
          }
        : {
            label: 'Payment Successful',
            color: isDark ? 'text-amber-400' : 'text-amber-600',
            icon: '!',
            message:
              'Payment succeeded, but the balance top-up has not completed yet. Please check again later or contact the administrator.',
          };
    }
  }

  if (order.status === 'PENDING') {
    return locale === 'en'
      ? {
          label: 'Awaiting Payment',
          color: isDark ? 'text-yellow-400' : 'text-yellow-600',
          icon: '⏳',
          message: 'The order has not been paid yet.',
        }
      : {
          label: 'Awaiting Payment',
          color: isDark ? 'text-yellow-400' : 'text-yellow-600',
          icon: '⏳',
          message: 'The order has not been paid yet.',
        };
  }

  if (order.status === 'EXPIRED') {
    return locale === 'en'
      ? {
          label: 'Order Expired',
          color: isDark ? 'text-slate-400' : 'text-gray-500',
          icon: '⏰',
          message: 'This order has expired. Please create a new order.',
        }
      : {
          label: 'Order Expired',
          color: isDark ? 'text-slate-400' : 'text-gray-500',
          icon: '⏰',
          message: 'This order has expired. Please create a new order.',
        };
  }

  if (order.status === 'CANCELLED') {
    return locale === 'en'
      ? {
          label: 'Order Cancelled',
          color: isDark ? 'text-slate-400' : 'text-gray-500',
          icon: '✗',
          message: 'This order has been cancelled.',
        }
      : {
          label: 'Order Cancelled',
          color: isDark ? 'text-slate-400' : 'text-gray-500',
          icon: '✗',
          message: 'This order has been cancelled.',
        };
  }

  return locale === 'en'
    ? {
        label: 'Payment Error',
        color: isDark ? 'text-red-400' : 'text-red-600',
        icon: '✗',
        message: 'Please contact the administrator.',
      }
    : {
        label: 'Payment Error',
        color: isDark ? 'text-red-400' : 'text-red-600',
        icon: '✗',
        message: 'Please contact the administrator.',
      };
}

function ResultContent() {
  const searchParams = useSearchParams();
  const outTradeNo = searchParams.get('out_trade_no') || searchParams.get('order_id');
  const accessToken = searchParams.get('access_token');
  const isPopup = searchParams.get('popup') === '1';
  const theme = searchParams.get('theme') === 'dark' ? 'dark' : 'light';
  const locale = resolveLocale(searchParams.get('lang'));
  const isDark = theme === 'dark';

  const text = {
    checking: pickLocaleText(locale, 'Checking payment result...', 'Checking payment result...'),
    back: pickLocaleText(locale, 'Back', 'Back'),
    closeSoon: pickLocaleText(locale, 'This window will close automatically in 3 seconds', 'This window will close automatically in 3 seconds'),
    closeNow: pickLocaleText(locale, 'Close now', 'Close now'),
    orderId: pickLocaleText(locale, 'Order ID', 'Order ID'),
    unknown: pickLocaleText(locale, 'Unknown', 'Unknown'),
  };

  const [orderState, setOrderState] = useState<PublicOrderStatusSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInPopup, setIsInPopup] = useState(false);

  useEffect(() => {
    if (isPopup || window.opener) {
      setIsInPopup(true);
    }
  }, [isPopup]);

  useEffect(() => {
    if (!outTradeNo || !accessToken || accessToken.length < 10) {
      setLoading(false);
      return;
    }

    const checkOrder = async () => {
      try {
        const res = await fetch(buildOrderStatusUrl(outTradeNo, accessToken));
        if (res.ok) {
          const data = (await res.json()) as PublicOrderStatusSnapshot;
          setOrderState(data);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    };

    checkOrder();
    const timer = setInterval(checkOrder, 3000);
    const timeout = setTimeout(() => clearInterval(timer), 30000);
    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, [outTradeNo, accessToken]);

  const shouldAutoClose = Boolean(orderState?.paymentSuccess);

  const goBack = () => {
    if (isInPopup) {
      closeCurrentWindow();
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    const params = new URLSearchParams();
    params.set('theme', theme);
    applyLocaleToSearchParams(params, locale);
    window.location.replace(`/pay?${params.toString()}`);
  };

  useEffect(() => {
    if (!isInPopup || !shouldAutoClose) return;
    const timer = setTimeout(() => {
      closeCurrentWindow();
    }, 3000);
    return () => clearTimeout(timer);
  }, [isInPopup, shouldAutoClose]);

  if (loading) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className={isDark ? 'text-slate-400' : 'text-gray-500'}>{text.checking}</div>
      </div>
    );
  }

  const display = getStatusConfig(orderState, locale, Boolean(accessToken), isDark);

  return (
    <div className={`flex min-h-screen items-center justify-center p-4 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div
        className={[
          'w-full max-w-md rounded-xl p-8 text-center shadow-lg',
          isDark ? 'bg-slate-900 text-slate-100' : 'bg-white',
        ].join(' ')}
      >
        <div className={`text-6xl ${display.color}`}>{display.icon}</div>
        <h1 className={`mt-4 text-xl font-bold ${display.color}`}>{display.label}</h1>
        <p className={isDark ? 'mt-2 text-slate-400' : 'mt-2 text-gray-500'}>{display.message}</p>

        {isInPopup ? (
          shouldAutoClose && (
            <div className="mt-4 space-y-2">
              <p className={isDark ? 'text-sm text-slate-500' : 'text-sm text-gray-400'}>{text.closeSoon}</p>
              <button
                type="button"
                onClick={closeCurrentWindow}
                className={`text-sm underline ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
              >
                {text.closeNow}
              </button>
            </div>
          )
        ) : (
          <button
            type="button"
            onClick={goBack}
            className={`mt-4 text-sm underline ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
          >
            {text.back}
          </button>
        )}

        <p className={isDark ? 'mt-4 text-xs text-slate-500' : 'mt-4 text-xs text-gray-400'}>
          {text.orderId}: {outTradeNo || text.unknown}
        </p>
      </div>
    </div>
  );
}

function ResultPageFallback() {
  const searchParams = useSearchParams();
  const locale = resolveLocale(searchParams.get('lang'));
  const isDark = searchParams.get('theme') === 'dark';

  return (
    <div className={`flex min-h-screen items-center justify-center ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className={isDark ? 'text-slate-400' : 'text-gray-500'}>
        {pickLocaleText(locale, 'Loading...', 'Loading...')}
      </div>
    </div>
  );
}

export default function PayResultPage() {
  return (
    <Suspense fallback={<ResultPageFallback />}>
      <ResultContent />
    </Suspense>
  );
}
