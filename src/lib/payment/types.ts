/** Unified payment method types across all providers */
export type PaymentType = string;

/**
 * Extract base payment method from composite key (e.g., 'alipay_direct' → 'alipay')
 * Used to map back to standard names when passing to third-party APIs
 */
export function getBasePaymentType(type: string): string {
  if (type.startsWith('alipay')) return 'alipay';
  if (type.startsWith('wxpay')) return 'wxpay';
  if (type.startsWith('stripe')) return 'stripe';
  if (type.startsWith('sepay')) return 'sepay';
  return type;
}

/** Request to create a payment with any provider */
export interface CreatePaymentRequest {
  orderId: string;
  amount: number; // in CNY (yuan)
  paymentType: PaymentType;
  subject: string; // product description
  notifyUrl?: string;
  returnUrl?: string;
  clientIp?: string;
  /** Whether from mobile (affects Alipay choosing PC page payment / H5 mobile website payment) */
  isMobile?: boolean;
}

/** Response from creating a payment */
export interface CreatePaymentResponse {
  tradeNo: string; // third-party transaction ID
  payUrl?: string; // H5 payment URL (alipay/wxpay)
  qrCode?: string; // QR code content
  clientSecret?: string; // Stripe PaymentIntent client secret (for embedded Payment Element)
}

/** Response from querying an order's payment status */
export interface QueryOrderResponse {
  tradeNo: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  amount: number;
  paidAt?: Date;
}

/** Parsed payment notification from webhook/notify callback */
export interface PaymentNotification {
  tradeNo: string;
  orderId: string;
  amount: number;
  status: 'success' | 'failed';
  rawData: unknown;
}

/** Request to refund a payment */
export interface RefundRequest {
  tradeNo: string;
  orderId: string;
  amount: number;
  reason?: string;
}

/** Response from a refund request */
export interface RefundResponse {
  refundId: string;
  status: 'success' | 'pending' | 'failed';
}

/** Per-method default limits declared by the provider */
export interface MethodDefaultLimits {
  /** Max amount per transaction, 0 = unlimited (use global MAX_RECHARGE_AMOUNT) */
  singleMax?: number;
  /** Global max amount per day, 0 = unlimited */
  dailyMax?: number;
}

/** Common interface that all payment providers must implement */
export interface PaymentProvider {
  readonly name: string;
  readonly providerKey: string;
  readonly supportedTypes: PaymentType[];
  /** Default limits per channel (key is PaymentType like 'alipay'), can be overridden by environment variables */
  readonly defaultLimits?: Record<string, MethodDefaultLimits>;

  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse>;
  queryOrder(tradeNo: string): Promise<QueryOrderResponse>;
  /** Returns null for unrecognized/irrelevant webhook events (caller should return 200). */
  verifyNotification(rawBody: string | Buffer, headers: Record<string, string>): Promise<PaymentNotification | null>;
  refund(request: RefundRequest): Promise<RefundResponse>;
  /** Cancel/expire a pending payment on the platform. Optional — not all providers support it. */
  cancelPayment?(tradeNo: string): Promise<void>;
}
