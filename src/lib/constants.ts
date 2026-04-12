/** Product / brand name used across the UI */
export const PRODUCT_NAME = 'CoffeeVideAI';

/** Order status */
export const ORDER_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  RECHARGING: 'RECHARGING',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
  REFUND_REQUESTED: 'REFUND_REQUESTED',
  REFUNDING: 'REFUNDING',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  REFUNDED: 'REFUNDED',
  REFUND_FAILED: 'REFUND_FAILED',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

/** Terminal status set (stop polling) */
export const TERMINAL_STATUSES = new Set<string>([
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.FAILED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.EXPIRED,
  ORDER_STATUS.PARTIALLY_REFUNDED,
  ORDER_STATUS.REFUNDED,
  ORDER_STATUS.REFUND_FAILED,
]);

/** Refund-related statuses */
export const REFUND_STATUSES = new Set<string>([
  ORDER_STATUS.REFUND_REQUESTED,
  ORDER_STATUS.REFUNDING,
  ORDER_STATUS.PARTIALLY_REFUNDED,
  ORDER_STATUS.REFUNDED,
  ORDER_STATUS.REFUND_FAILED,
]);

/** Payment method identifier */
export const PAYMENT_TYPE = {
  SEPAY: 'sepay',
} as const;

/** Payment method prefix (used for startsWith check) */
export const PAYMENT_PREFIX = {
  SEPAY: 'sepay',
} as const;
