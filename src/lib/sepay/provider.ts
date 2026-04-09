import { getEnv } from '@/lib/config';
import { getSystemConfig } from '@/lib/system-config';
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

export interface SepayWebhookPayload {
  id: number;
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  code: string;
  content: string;
  transferType: string;
  transferAmount: number;
  accumulated: number;
  subAccount: string;
  referenceCode: string;
  description: string;
}

/**
 * Extract a recharge code from SePay webhook fields.
 * Format: ORDER + 10 digits (e.g., ORDER1234567890)
 */
export function extractRechargeCode(text: string): string | null {
  const match = text.match(/\bORDER\d{10}\b/);
  return match ? match[0] : null;
}

export class SepayProvider implements PaymentProvider {
  readonly name: string;
  readonly providerKey = 'sepay';
  readonly supportedTypes: PaymentType[] = ['sepay'];
  readonly defaultLimits?: Record<string, MethodDefaultLimits>;
  readonly instanceId?: string;
  private instanceConfig?: Record<string, string>;

  constructor(instanceId?: string, instanceConfig?: Record<string, string>) {
    this.instanceId = instanceId;
    this.instanceConfig = instanceConfig;
    this.name = instanceId ? `sepay:${instanceId}` : 'sepay';
  }

  private getConfig(key: string): string | undefined {
    return this.instanceConfig?.[key];
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    // SePay is a bank transfer monitor — no external API call needed.
    // The orderId (which is the rechargeCode) serves as the transfer memo code.
    // Generate a VietQR code URL via SePay's QR API.
    const bankAccount = this.getConfig('bankAccount') || (await getSystemConfig('SEPAY_BANK_ACCOUNT')) || getEnv().SEPAY_BANK_ACCOUNT || '';
    const bankName = this.getConfig('bankName') || (await getSystemConfig('SEPAY_BANK_NAME')) || getEnv().SEPAY_BANK_NAME || '';

    let qrCode: string | undefined;
    if (bankAccount && bankName) {
      const amount = Math.round(request.amount);
      qrCode = `https://qr.sepay.vn/img?acc=${encodeURIComponent(bankAccount)}&bank=${encodeURIComponent(bankName)}&amount=${amount}&des=${encodeURIComponent(request.orderId)}`;
    }

    return {
      tradeNo: request.orderId,
      qrCode,
    };
  }

  async queryOrder(tradeNo: string): Promise<QueryOrderResponse> {
    // SePay is push-only (webhook). We check our own DB for the order status.
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
    rawBody: string | Buffer,
    headers: Record<string, string>,
  ): Promise<PaymentNotification | null> {
    // Validate API key
    const apiKey = this.getConfig('apiKey') || (await getSystemConfig('SEPAY_API_KEY')) || getEnv().SEPAY_API_KEY;
    if (!apiKey) {
      throw new Error('SEPAY_API_KEY not configured');
    }

    const authHeader = headers['authorization'] || headers['Authorization'] || '';
    if (!authHeader.startsWith('Apikey ') || authHeader.slice(7) !== apiKey) {
      throw new Error('SePay webhook unauthorized');
    }

    // Parse payload
    const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
    const payload: SepayWebhookPayload = JSON.parse(body);

    // Only process incoming transfers with positive amount
    if (payload.transferType !== 'in' || payload.transferAmount <= 0) {
      return null;
    }

    // Try to find matching order by extracting rechargeCode from both `code` and `content` fields
    const code = extractRechargeCode(payload.code) || extractRechargeCode(payload.content);
    if (!code) {
      return null;
    }

    // Find matching PENDING sepay order
    const order = await prisma.order.findFirst({
      where: {
        rechargeCode: code,
        paymentType: 'sepay',
        status: 'PENDING',
      },
      select: { id: true, payAmount: true, amount: true },
    });

    if (!order) {
      return null;
    }

    // Validate amount: parseInt(order.payAmount) === transferAmount
    const expectedAmount = Math.round(Number(order.payAmount ?? order.amount));
    if (expectedAmount !== payload.transferAmount) {
      console.warn(
        `[sepay] Amount mismatch for order ${order.id}: expected ${expectedAmount}, got ${payload.transferAmount}`,
      );
      return null;
    }

    return {
      tradeNo: String(payload.id),
      orderId: order.id,
      amount: Number(order.payAmount ?? order.amount),
      status: 'success',
      rawData: payload,
    };
  }

  async refund(_request: RefundRequest): Promise<RefundResponse> {
    throw new Error('SePay (bank transfer) does not support automatic refunds');
  }
}
