import { initPaymentProviders, paymentRegistry } from '@/lib/payment';
import { Prisma } from '@prisma/client';

/**
 * Get transaction fee rate (percentage) for specified payment channel.
 * Priority: FEE_RATE_{TYPE} > FEE_RATE_PROVIDER_{KEY} > 0
 */
export function getMethodFeeRate(paymentType: string): number {
  // Channel level: FEE_RATE_ALIPAY / FEE_RATE_WXPAY / FEE_RATE_STRIPE
  const methodRaw = process.env[`FEE_RATE_${paymentType.toUpperCase()}`];
  if (methodRaw !== undefined && methodRaw !== '') {
    const num = Number(methodRaw);
    if (Number.isFinite(num) && num >= 0) return num;
  }

  // Provider level: FEE_RATE_PROVIDER_EASYPAY / FEE_RATE_PROVIDER_STRIPE
  initPaymentProviders();
  const providerKey = paymentRegistry.getProviderKey(paymentType);
  if (providerKey) {
    const providerRaw = process.env[`FEE_RATE_PROVIDER_${providerKey.toUpperCase()}`];
    if (providerRaw !== undefined && providerRaw !== '') {
      const num = Number(providerRaw);
      if (Number.isFinite(num) && num >= 0) return num;
    }
  }

  return 0;
}

/** decimal.js ROUND_UP = 0 (round away from zero) */
const ROUND_UP = 0;

/**
 * Calculate actual payment amount from recharge amount and fee rate (using Decimal for precision, avoiding floating point errors).
 * feeAmount = ceil(rechargeAmount * feeRate / 100, keep 2 decimal places)
 * payAmount = rechargeAmount + feeAmount
 */
export function calculatePayAmount(rechargeAmount: number, feeRate: number): string {
  if (feeRate <= 0) return rechargeAmount.toFixed(2);
  const amount = new Prisma.Decimal(rechargeAmount);
  const rate = new Prisma.Decimal(feeRate.toString());
  const feeAmount = amount.mul(rate).div(100).toDecimalPlaces(2, ROUND_UP);
  return amount.plus(feeAmount).toFixed(2);
}
