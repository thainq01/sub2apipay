'use client';

import { useEffect, useRef, useState } from 'react';
import type { Locale } from '@/lib/locale';
import type { PublicOrderStatusSnapshot } from '@/lib/order/status';
import { buildOrderStatusUrl } from '@/lib/order/status-url';

interface OrderStatusProps {
  orderId: string;
  order: PublicOrderStatusSnapshot;
  statusAccessToken?: string;
  onBack: () => void;
  onStateChange?: (order: PublicOrderStatusSnapshot) => void;
  dark?: boolean;
  locale?: Locale;
  orderType?: 'balance' | 'subscription';
  homeUrl?: string;
  onGoHome?: () => void;
}

function getStatusConfig(order: PublicOrderStatusSnapshot, locale: Locale, isDark = false, orderType?: 'balance' | 'subscription') {
  const isSubscription = orderType === 'subscription';

  if (order.rechargeSuccess) {
    if (isSubscription) {
      return locale === 'vi'
        ? {
            label: 'Kích hoạt thành công',
            color: isDark ? 'text-green-400' : 'text-green-600',
            icon: '✓',
            message: 'Gói đăng ký đã được kích hoạt cho tài khoản của bạn!',
          }
        : {
            label: 'Subscription Activated',
            color: isDark ? 'text-green-400' : 'text-green-600',
            icon: '✓',
            message: 'Your subscription has been activated successfully!',
          };
    }
    return locale === 'vi'
      ? {
          label: 'Nạp tiền thành công',
          color: isDark ? 'text-green-400' : 'text-green-600',
          icon: '✓',
          message: 'Số dư đã được cập nhật. Cảm ơn bạn đã nạp tiền!',
        }
      : {
          label: 'Recharge Successful',
          color: isDark ? 'text-green-400' : 'text-green-600',
          icon: '✓',
          message: 'Your balance has been credited. Thank you for your payment.',
        };
  }

  if (order.paymentSuccess) {
    if (order.rechargeStatus === 'paid_pending' || order.rechargeStatus === 'recharging') {
      if (isSubscription) {
        return locale === 'vi'
          ? {
              label: 'Đang kích hoạt',
              color: isDark ? 'text-blue-400' : 'text-blue-600',
              icon: '⟳',
              message: 'Đã nhận thanh toán. Đang kích hoạt gói đăng ký...',
            }
          : {
              label: 'Activating',
              color: isDark ? 'text-blue-400' : 'text-blue-600',
              icon: '⟳',
              message: 'Payment received. Activating your subscription...',
            };
      }
      return locale === 'vi'
        ? {
            label: 'Đang nạp tiền',
            color: isDark ? 'text-blue-400' : 'text-blue-600',
            icon: '⟳',
            message: 'Đã nhận thanh toán. Đang cập nhật số dư, vui lòng chờ...',
          }
        : {
            label: 'Recharging',
            color: isDark ? 'text-blue-400' : 'text-blue-600',
            icon: '⟳',
            message: 'Payment received. Recharging your balance...',
          };
    }

    if (order.rechargeStatus === 'failed') {
      if (isSubscription) {
        return locale === 'vi'
          ? {
              label: 'Thanh toán thành công',
              color: isDark ? 'text-amber-400' : 'text-amber-600',
              icon: '!',
              message:
                'Thanh toán đã hoàn tất, nhưng kích hoạt đăng ký chưa hoàn thành. Hệ thống có thể thử lại tự động. Vui lòng kiểm tra danh sách đơn hàng sau này hoặc liên hệ quản trị viên.',
            }
          : {
              label: 'Payment Successful',
              color: isDark ? 'text-amber-400' : 'text-amber-600',
              icon: '!',
              message:
                'Payment completed, but the subscription activation has not finished yet. The system may retry automatically. Please check the order list later or contact the administrator.',
            };
      }
      return locale === 'vi'
        ? {
            label: 'Thanh toán thành công',
            color: isDark ? 'text-amber-400' : 'text-amber-600',
            icon: '!',
            message:
              'Thanh toán đã hoàn tất, nhưng nạp tiền vào số dư chưa hoàn thành. Hệ thống có thể thử lại tự động. Vui lòng kiểm tra danh sách đơn hàng sau này hoặc liên hệ quản trị viên nếu vẫn chưa được giải quyết.',
          }
        : {
            label: 'Payment Successful',
            color: isDark ? 'text-amber-400' : 'text-amber-600',
            icon: '!',
            message:
              'Payment completed, but the balance top-up has not finished yet. The system may retry automatically. Please check the order list later or contact the administrator if it remains unresolved.',
          };
    }
  }

  if (order.status === 'FAILED') {
    return locale === 'vi'
      ? {
          label: 'Thanh toán không thành công',
          color: isDark ? 'text-red-400' : 'text-red-600',
          icon: '✗',
          message:
            'Thanh toán không hoàn tất. Vui lòng thử lại. Nếu tiền đã bị trừ nhưng chưa được cập nhật, hãy liên hệ quản trị viên.',
        }
      : {
          label: 'Payment Failed',
          color: isDark ? 'text-red-400' : 'text-red-600',
          icon: '✗',
          message:
            'Payment was not completed. Please try again. If funds were deducted but not credited, contact the administrator.',
        };
  }

  if (order.status === 'PENDING') {
    return locale === 'vi'
      ? {
          label: 'Chờ thanh toán',
          color: isDark ? 'text-yellow-400' : 'text-yellow-600',
          icon: '⏳',
          message: 'Đơn hàng chưa được thanh toán.',
        }
      : {
          label: 'Awaiting Payment',
          color: isDark ? 'text-yellow-400' : 'text-yellow-600',
          icon: '⏳',
          message: 'The order has not been paid yet.',
        };
  }

  if (order.status === 'EXPIRED') {
    return locale === 'vi'
      ? {
          label: 'Đơn hàng hết hạn',
          color: isDark ? 'text-slate-400' : 'text-gray-500',
          icon: '⏰',
          message: 'Đơn hàng này đã hết hạn. Vui lòng tạo một đơn hàng mới.',
        }
      : {
          label: 'Order Expired',
          color: isDark ? 'text-slate-400' : 'text-gray-500',
          icon: '⏰',
          message: 'This order has expired. Please create a new one.',
        };
  }

  if (order.status === 'CANCELLED') {
    return locale === 'vi'
      ? {
          label: 'Đã hủy',
          color: isDark ? 'text-slate-400' : 'text-gray-500',
          icon: '✗',
          message: 'Đơn hàng đã bị hủy.',
        }
      : { label: 'Cancelled', color: isDark ? 'text-slate-400' : 'text-gray-500', icon: '✗', message: 'The order has been cancelled.' };
  }

  return locale === 'vi'
    ? {
        label: 'Lỗi thanh toán',
        color: isDark ? 'text-red-400' : 'text-red-600',
        icon: '✗',
        message: 'Trạng thái thanh toán bất thường. Vui lòng liên hệ quản trị viên.',
      }
    : {
        label: 'Payment Error',
        color: isDark ? 'text-red-400' : 'text-red-600',
        icon: '✗',
        message: 'Payment status is abnormal. Please contact the administrator.',
      };
}

export default function OrderStatus({
  orderId,
  order,
  statusAccessToken,
  onBack,
  onStateChange,
  dark = false,
  locale = 'en',
  orderType,
  homeUrl,
  onGoHome,
}: OrderStatusProps) {
  const [currentOrder, setCurrentOrder] = useState(order);
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  });

  useEffect(() => {
    setCurrentOrder(order);
  }, [order]);

  useEffect(() => {
    if (!orderId || !currentOrder.paymentSuccess || currentOrder.rechargeSuccess) {
      return;
    }

    let cancelled = false;

    const refreshOrder = async () => {
      try {
        const response = await fetch(buildOrderStatusUrl(orderId, statusAccessToken));
        if (!response.ok) return;
        const nextOrder = (await response.json()) as PublicOrderStatusSnapshot;
        if (cancelled) return;
        setCurrentOrder(nextOrder);
        onStateChangeRef.current?.(nextOrder);
      } catch {}
    };

    refreshOrder();
    const timer = setInterval(refreshOrder, 3000);
    const timeout = setTimeout(() => clearInterval(timer), 30000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, [orderId, currentOrder.paymentSuccess, currentOrder.rechargeSuccess, statusAccessToken]);

  const isSubscription = orderType === 'subscription';
  const config = getStatusConfig(currentOrder, locale, dark, orderType);
  const doneLabel = locale === 'vi' ? 'Hoàn thành' : 'Done';
  const homeLabel = locale === 'vi' ? 'Quay lại trang chủ' : 'Back to Home';
  const backLabel = isSubscription
    ? (locale === 'vi' ? 'Quay lại gói đăng ký' : 'Back to Subscriptions')
    : (locale === 'vi' ? 'Quay lại nạp tiền' : 'Back to Recharge');

  // For cancelled/expired/failed orders, redirect to home
  const isCancelledOrFailed = currentOrder.status === 'CANCELLED' || currentOrder.status === 'EXPIRED' || currentOrder.status === 'FAILED';
  const shouldGoHome = isCancelledOrFailed && (homeUrl || onGoHome);

  const handleButtonClick = () => {
    if (shouldGoHome) {
      if (onGoHome) {
        onGoHome();
      } else if (homeUrl) {
        window.location.href = homeUrl;
      }
    } else {
      onBack();
    }
  };

  const buttonLabel = currentOrder.rechargeSuccess
    ? doneLabel
    : shouldGoHome
      ? homeLabel
      : backLabel;

  return (
    <div className="flex flex-col items-center space-y-4 py-8">
      <div className={`text-6xl ${config.color}`}>{config.icon}</div>
      <h2 className={`text-xl font-bold ${config.color}`}>{config.label}</h2>
      <p className={['text-center', dark ? 'text-slate-400' : 'text-gray-500'].join(' ')}>{config.message}</p>
      <button
        onClick={handleButtonClick}
        className={[
          'mt-4 w-full rounded-lg py-3 font-medium text-white',
          dark ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-600 hover:bg-blue-700',
        ].join(' ')}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
