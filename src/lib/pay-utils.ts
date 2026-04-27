import { ORDER_STATUS, PAYMENT_TYPE, PAYMENT_PREFIX } from './constants';
import type { Locale } from './locale';

export interface UserInfo {
  id?: number;
  username: string;
  balance?: number;
}

export interface MyOrder {
  id: string;
  amount: number;
  status: string;
  paymentType: string;
  createdAt: string;
  expiresAt?: string;
  orderType?: string;
  subscriptionPlanName?: string | null;
  refundRequestedAt?: string | null;
  refundRequestReason?: string | null;
  refundAmount?: number | null;
  canRefundRequest?: boolean;
}

export type OrderStatusFilter =
  | 'ALL'
  | 'PENDING'
  | 'PAID'
  | 'COMPLETED'
  | 'REFUND_REQUESTED'
  | 'REFUNDING'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'REFUND_FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED';

const STATUS_TEXT_MAP: Record<Locale, Record<string, string>> = {
  vi: {
    [ORDER_STATUS.PENDING]: 'Chờ thanh toán',
    [ORDER_STATUS.PAID]: 'Đã thanh toán',
    [ORDER_STATUS.RECHARGING]: 'Đang nạp',
    [ORDER_STATUS.COMPLETED]: 'Hoàn thành',
    [ORDER_STATUS.REFUND_REQUESTED]: 'Đang yêu cầu',
    [ORDER_STATUS.REFUNDING]: 'Đang hoàn tiền',
    [ORDER_STATUS.PARTIALLY_REFUNDED]: 'Hoàn tiền một phần',
    [ORDER_STATUS.REFUNDED]: 'Đã hoàn tiền',
    [ORDER_STATUS.REFUND_FAILED]: 'Hoàn tiền thất bại',
    [ORDER_STATUS.EXPIRED]: 'Hết hạn',
    [ORDER_STATUS.CANCELLED]: 'Đã hủy',
    [ORDER_STATUS.FAILED]: 'Thất bại',
  },
  en: {
    [ORDER_STATUS.PENDING]: 'Pending',
    [ORDER_STATUS.PAID]: 'Paid',
    [ORDER_STATUS.RECHARGING]: 'Recharging',
    [ORDER_STATUS.COMPLETED]: 'Completed',
    [ORDER_STATUS.REFUND_REQUESTED]: 'Requested',
    [ORDER_STATUS.REFUNDING]: 'Refunding',
    [ORDER_STATUS.PARTIALLY_REFUNDED]: 'Partially refunded',
    [ORDER_STATUS.REFUNDED]: 'Refunded',
    [ORDER_STATUS.REFUND_FAILED]: 'Refund failed',
    [ORDER_STATUS.EXPIRED]: 'Expired',
    [ORDER_STATUS.CANCELLED]: 'Cancelled',
    [ORDER_STATUS.FAILED]: 'Failed',
  },
};

const FILTER_OPTIONS_MAP: Record<Locale, { key: OrderStatusFilter; label: string }[]> = {
  vi: [
    { key: 'ALL', label: 'Tất cả' },
    { key: 'PENDING', label: 'Chờ thanh toán' },
    { key: 'COMPLETED', label: 'Hoàn thành' },
    { key: 'REFUND_REQUESTED', label: 'Đang yêu cầu' },
    { key: 'REFUNDING', label: 'Đang hoàn tiền' },
    { key: 'PARTIALLY_REFUNDED', label: 'Hoàn tiền một phần' },
    { key: 'REFUNDED', label: 'Đã hoàn tiền' },
    { key: 'REFUND_FAILED', label: 'Hoàn tiền thất bại' },
    { key: 'CANCELLED', label: 'Đã hủy' },
    { key: 'EXPIRED', label: 'Hết hạn' },
  ],
  en: [
    { key: 'ALL', label: 'All' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'COMPLETED', label: 'Completed' },
    { key: 'REFUND_REQUESTED', label: 'Requested' },
    { key: 'REFUNDING', label: 'Refunding' },
    { key: 'PARTIALLY_REFUNDED', label: 'Partially refunded' },
    { key: 'REFUNDED', label: 'Refunded' },
    { key: 'REFUND_FAILED', label: 'Refund failed' },
    { key: 'CANCELLED', label: 'Cancelled' },
    { key: 'EXPIRED', label: 'Expired' },
  ],
};

export function getFilterOptions(locale: Locale = 'vi'): { key: OrderStatusFilter; label: string }[] {
  return FILTER_OPTIONS_MAP[locale];
}

export function detectDeviceIsMobile(): boolean {
  if (typeof window === 'undefined') return false;

  const uad = (navigator as Navigator & { userAgentData?: { mobile: boolean } }).userAgentData;
  if (uad !== undefined) return uad.mobile;

  const ua = navigator.userAgent || '';
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Windows Phone|Mobile/i.test(ua);
  if (mobileUA) return true;

  const smallPhysicalScreen = Math.min(window.screen.width, window.screen.height) <= 768;
  const touchCapable = navigator.maxTouchPoints > 1;
  return touchCapable && smallPhysicalScreen;
}

export function formatStatus(status: string, locale: Locale = 'vi'): string {
  return STATUS_TEXT_MAP[locale][status] || status;
}

export function formatCreatedAt(value: string, locale: Locale = 'vi'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN');
}

export function formatVND(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ☕';
}

export function formatUSDT(amount: number): string {
  return amount.toFixed(2) + ' USDT';
}

export interface PaymentTypeMeta {
  label: string;
  sublabel?: string;
  provider: string;
  color: string;
  selectedBorder: string;
  selectedBg: string;
  selectedBgDark: string;
  iconBg: string;
  iconSrc?: string;
  chartBar: { light: string; dark: string };
  buttonClass: string;
}

export const PAYMENT_TYPE_META: Record<string, PaymentTypeMeta> = {
  [PAYMENT_TYPE.SEPAY]: {
    label: 'Bank Transfer',
    provider: 'SePay',
    color: '#2563eb',
    selectedBorder: 'border-blue-600',
    selectedBg: 'bg-blue-50',
    selectedBgDark: 'bg-blue-950',
    iconBg: 'bg-blue-600',
    iconSrc: '/icons/bank.svg',
    chartBar: { light: 'bg-blue-500', dark: 'bg-blue-400' },
    buttonClass: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800',
  },
  [PAYMENT_TYPE.BSC_USDT]: {
    label: 'Transfer USDT',
    sublabel: 'BEP-20',
    provider: 'BSC',
    color: '#16a34a',
    selectedBorder: 'border-green-600',
    selectedBg: 'bg-green-50',
    selectedBgDark: 'bg-green-950',
    iconBg: 'bg-green-600',
    iconSrc: '/icons/usdt.svg',
    chartBar: { light: 'bg-green-500', dark: 'bg-green-400' },
    buttonClass: 'bg-green-600 hover:bg-green-700 active:bg-green-800',
  },
};

const PAYMENT_TEXT_MAP: Record<Locale, Record<string, { label: string; provider: string; sublabel?: string }>> = {
  vi: {
    [PAYMENT_TYPE.SEPAY]: { label: 'Chuyển khoản', provider: 'SePay' },
    [PAYMENT_TYPE.BSC_USDT]: { label: 'Chuyển USDT', provider: 'BSC', sublabel: 'BEP-20' },
  },
  en: {
    [PAYMENT_TYPE.SEPAY]: { label: 'Bank Transfer', provider: 'SePay' },
    [PAYMENT_TYPE.BSC_USDT]: { label: 'Transfer USDT', provider: 'BSC', sublabel: 'BEP-20' },
  },
};

function getPaymentText(type: string, locale: Locale = 'vi'): { label: string; provider: string; sublabel?: string } {
  const meta = PAYMENT_TYPE_META[type];
  if (!meta) return { label: type, provider: '' };
  const baseText = PAYMENT_TEXT_MAP[locale][type] || { label: meta.label, provider: meta.provider };
  return {
    ...baseText,
    sublabel: meta.sublabel,
  };
}

export function getPaymentTypeLabel(type: string, locale: Locale = 'vi'): string {
  const meta = getPaymentText(type, locale);
  if (!meta) return type;
  if (meta.sublabel) {
    return locale === 'en' ? `${meta.label} (${meta.sublabel})` : `${meta.label}（${meta.sublabel}）`;
  }
  return meta.label;
}

export function getPaymentDisplayInfo(
  type: string,
  locale: Locale = 'vi',
): { channel: string; provider: string; sublabel?: string } {
  const meta = getPaymentText(type, locale);
  return { channel: meta.label, provider: meta.provider, sublabel: meta.sublabel };
}

export function getPaymentMeta(type: string): PaymentTypeMeta {
  return PAYMENT_TYPE_META[type] || PAYMENT_TYPE_META[PAYMENT_TYPE.SEPAY];
}

export function getPaymentIconSrc(type: string): string {
  return getPaymentMeta(type).iconSrc || '';
}

export function getPaymentChannelLabel(type: string, locale: Locale = 'vi'): string {
  return getPaymentDisplayInfo(type, locale).channel;
}

export function isSepayType(type: string | undefined | null): boolean {
  return !!type?.startsWith(PAYMENT_PREFIX.SEPAY);
}

export function isBscUsdtType(type: string | undefined | null): boolean {
  return !!type?.startsWith(PAYMENT_PREFIX.BSC_USDT);
}

export function applySublabelOverrides(overrides: Record<string, string>): void {
  for (const [type, sublabel] of Object.entries(overrides)) {
    if (PAYMENT_TYPE_META[type]) {
      PAYMENT_TYPE_META[type] = { ...PAYMENT_TYPE_META[type], sublabel };
    }
  }
}

export function getStatusBadgeClass(status: string, isDark: boolean): string {
  if (status === ORDER_STATUS.COMPLETED || status === ORDER_STATUS.PAID) {
    return isDark ? 'bg-emerald-500/20 text-emerald-200' : 'bg-emerald-100 text-emerald-700';
  }
  if (status === ORDER_STATUS.REFUND_REQUESTED) {
    return isDark ? 'bg-violet-500/20 text-violet-200' : 'bg-violet-100 text-violet-700';
  }
  if (status === ORDER_STATUS.REFUNDING) {
    return isDark ? 'bg-orange-500/20 text-orange-200' : 'bg-orange-100 text-orange-700';
  }
  if (status === ORDER_STATUS.PARTIALLY_REFUNDED) {
    return isDark ? 'bg-fuchsia-500/20 text-fuchsia-200' : 'bg-fuchsia-100 text-fuchsia-700';
  }
  if (status === ORDER_STATUS.REFUNDED) {
    return isDark ? 'bg-purple-500/20 text-purple-200' : 'bg-purple-100 text-purple-700';
  }
  if (status === ORDER_STATUS.REFUND_FAILED) {
    return isDark ? 'bg-red-500/20 text-red-200' : 'bg-red-100 text-red-700';
  }
  if (status === ORDER_STATUS.PENDING) {
    return isDark ? 'bg-blue-500/20 text-blue-200' : 'bg-blue-100 text-blue-700';
  }
  const GREY_STATUSES = new Set<string>([ORDER_STATUS.CANCELLED, ORDER_STATUS.EXPIRED, ORDER_STATUS.FAILED]);
  if (GREY_STATUSES.has(status)) {
    return isDark ? 'bg-slate-600 text-slate-200' : 'bg-slate-100 text-slate-700';
  }
  return isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700';
}
