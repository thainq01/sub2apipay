import { ORDER_STATUS, REFUND_STATUSES } from '@/lib/constants';

export type RechargeStatus = 'not_paid' | 'paid_pending' | 'recharging' | 'success' | 'failed' | 'closed';

export interface OrderStatusLike {
  status: string;
  paidAt?: Date | string | null;
  completedAt?: Date | string | null;
}

export interface DerivedOrderState {
  paymentSuccess: boolean;
  rechargeSuccess: boolean;
  rechargeStatus: RechargeStatus;
}

export interface PublicOrderStatusSnapshot extends DerivedOrderState {
  id: string;
  status: string;
  expiresAt: Date | string;
  failedReason?: string | null;
}

export interface OrderDisplayState {
  label: string;
  color: string;
  icon: string;
  message: string;
}

const CLOSED_STATUSES = new Set<string>([
  ORDER_STATUS.EXPIRED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.REFUND_REQUESTED,
  ORDER_STATUS.REFUNDING,
  ORDER_STATUS.PARTIALLY_REFUNDED,
  ORDER_STATUS.REFUNDED,
  ORDER_STATUS.REFUND_FAILED,
]);

function hasDate(value: Date | string | null | undefined): boolean {
  return Boolean(value);
}

export function isRefundStatus(status: string): boolean {
  return REFUND_STATUSES.has(status);
}

export function isRechargeRetryable(order: OrderStatusLike): boolean {
  return hasDate(order.paidAt) && order.status === ORDER_STATUS.FAILED && !isRefundStatus(order.status);
}

export function deriveOrderState(order: OrderStatusLike): DerivedOrderState {
  const paymentSuccess = hasDate(order.paidAt);
  const rechargeSuccess = hasDate(order.completedAt) || order.status === ORDER_STATUS.COMPLETED;

  if (rechargeSuccess) {
    return { paymentSuccess, rechargeSuccess: true, rechargeStatus: 'success' };
  }

  if (order.status === ORDER_STATUS.RECHARGING) {
    return { paymentSuccess, rechargeSuccess: false, rechargeStatus: 'recharging' };
  }

  if (order.status === ORDER_STATUS.FAILED) {
    return { paymentSuccess, rechargeSuccess: false, rechargeStatus: 'failed' };
  }

  if (CLOSED_STATUSES.has(order.status)) {
    return { paymentSuccess, rechargeSuccess: false, rechargeStatus: 'closed' };
  }

  if (paymentSuccess) {
    return { paymentSuccess, rechargeSuccess: false, rechargeStatus: 'paid_pending' };
  }

  return { paymentSuccess: false, rechargeSuccess: false, rechargeStatus: 'not_paid' };
}

export function getOrderDisplayState(
  order: Pick<PublicOrderStatusSnapshot, 'status' | 'paymentSuccess' | 'rechargeSuccess' | 'rechargeStatus'>,
): OrderDisplayState {
  if (order.status === ORDER_STATUS.REFUND_REQUESTED) {
    return {
      label: 'Requested',
      color: 'text-violet-600',
      icon: '…',
      message: 'Refund request submitted, waiting for administrator confirmation.',
    };
  }

  if (order.status === ORDER_STATUS.REFUNDING) {
    return {
      label: 'Refunding',
      color: 'text-orange-600',
      icon: '⟳',
      message: 'Administrator confirmed refund, processing refund, please wait.',
    };
  }

  if (order.status === ORDER_STATUS.PARTIALLY_REFUNDED) {
    return {
      label: 'Partially refunded',
      color: 'text-fuchsia-600',
      icon: '✓',
      message: 'Order completed partial refund.',
    };
  }

  if (order.status === ORDER_STATUS.REFUNDED) {
    return {
      label: 'Refunded',
      color: 'text-purple-600',
      icon: '✓',
      message: 'Order completed refund.',
    };
  }

  if (order.status === ORDER_STATUS.REFUND_FAILED) {
    return {
      label: 'Refund failed',
      color: 'text-red-600',
      icon: '✗',
      message: 'Refund processing failed, please contact administrator.',
    };
  }

  if (order.rechargeSuccess || order.rechargeStatus === 'success') {
    return {
      label: 'Recharge success',
      color: 'text-green-600',
      icon: '✓',
      message: 'Balance received, thank you for your recharge!',
    };
  }

  if (order.paymentSuccess) {
    if (order.rechargeStatus === 'paid_pending' || order.rechargeStatus === 'recharging') {
      return {
        label: 'Recharging',
        color: 'text-blue-600',
        icon: '⟳',
        message: 'Payment successful, recharging balance, please wait...',
      };
    }

    if (order.rechargeStatus === 'failed') {
      return {
        label: 'Payment successful',
        color: 'text-amber-600',
        icon: '!',
        message: 'Payment completed, but balance recharge not yet completed. The system may auto-retry, check order list later; if not received for a long time, contact administrator.',
      };
    }
  }

  if (order.status === ORDER_STATUS.FAILED) {
    return {
      label: 'Payment failed',
      color: 'text-red-600',
      icon: '✗',
      message: 'Payment not completed, please initiate payment again; if deducted but not received, contact administrator to process.',
    };
  }

  if (order.status === ORDER_STATUS.PENDING) {
    return {
      label: 'Awaiting payment',
      color: 'text-yellow-600',
      icon: '⏳',
      message: 'Order payment not yet completed.',
    };
  }

  if (order.status === ORDER_STATUS.EXPIRED) {
    return {
      label: 'Order expired',
      color: 'text-gray-500',
      icon: '⏰',
      message: 'Order expired, please create a new order.',
    };
  }

  if (order.status === ORDER_STATUS.CANCELLED) {
    return {
      label: 'Cancelled',
      color: 'text-gray-500',
      icon: '✗',
      message: 'Order cancelled.',
    };
  }

  return {
    label: 'Payment exception',
    color: 'text-red-600',
    icon: '✗',
    message: 'Payment status exception, please contact administrator to process.',
  };
}
