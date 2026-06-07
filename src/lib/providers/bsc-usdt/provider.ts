import { getEnv } from '@/lib/config';
import { prisma } from '@/lib/db';
import type {
  PaymentProvider,
  PaymentType,
  CreatePaymentRequest,
  CreatePaymentResponse,
  QueryOrderResponse,
  PaymentNotification,
  RefundRequest,
  RefundResponse,
  MethodDefaultLimits,
} from '@/lib/payment/types';

/**
 * Generate a unique USDT pay amount by appending small random fractions.
 * Uses 3rd decimal place (0.001–0.099) to keep the amount close to the original.
 * Retries until no pending bsc-usdt order has the same payAmount.
 */
export async function generateUniqueUsdtAmount(baseAmount: number): Promise<string> {
  const maxRetries = 50;
  for (let i = 0; i < maxRetries; i++) {
    const fraction = Math.floor(Math.random() * 99) + 1; // 001–099
    const candidate = baseAmount + fraction / 1000;
    const candidateStr = candidate.toFixed(3);

    const existing = await prisma.order.findFirst({
      where: {
        paymentType: 'bsc-usdt',
        status: 'PENDING',
        payAmount: candidateStr,
      },
      select: { id: true },
    });

    if (!existing) return candidateStr;
  }
  // Fallback: use exact amount (extremely unlikely to reach here)
  return baseAmount.toFixed(3);
}

export class BscUsdtProvider implements PaymentProvider {
  readonly name: string;
  readonly providerKey = 'bsc-usdt';
  readonly supportedTypes: PaymentType[] = ['bsc-usdt'];
  readonly defaultLimits?: Record<string, MethodDefaultLimits>;
  readonly instanceId?: string;

  constructor(instanceId?: string) {
    this.instanceId = instanceId;
    this.name = instanceId ? `bsc-usdt:${instanceId}` : 'bsc-usdt';
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const env = getEnv();
    const walletAddress = env.BSC_WALLET_ADDRESS;
    if (!walletAddress) {
      throw new Error('BSC_WALLET_ADDRESS not configured');
    }

    return {
      tradeNo: request.orderId,
      qrCode: walletAddress,
    };
  }

  async queryOrder(tradeNo: string): Promise<QueryOrderResponse> {
    const order = await prisma.order.findUnique({
      where: { id: tradeNo },
      select: { status: true, payAmount: true, amount: true, paidAt: true },
    });

    if (!order) {
      return { tradeNo, status: 'pending', amount: 0 };
    }

    const isPaid = order.status !== 'PENDING' && order.status !== 'EXPIRED' && order.status !== 'CANCELLED';
    return {
      tradeNo,
      status: isPaid ? 'paid' : 'pending',
      amount: Number(order.payAmount ?? order.amount),
      paidAt: order.paidAt ?? undefined,
    };
  }

  async verifyNotification(
    _rawBody: string | Buffer,
    _headers: Record<string, string>,
  ): Promise<PaymentNotification | null> {
    // BSC USDT uses scanner-based detection, not webhooks
    throw new Error('BSC USDT does not use webhook notifications. Use the scanner instead.');
  }

  async refund(_request: RefundRequest): Promise<RefundResponse> {
    throw new Error('BSC USDT does not support automatic refunds');
  }
}
