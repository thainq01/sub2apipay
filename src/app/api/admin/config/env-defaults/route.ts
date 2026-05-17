import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken, unauthorizedResponse } from '@/lib/admin-auth';
import { getEnv } from '@/lib/config';
import { ensureDBProviders, paymentRegistry } from '@/lib/payment';

export async function GET(request: NextRequest) {
  if (!(await verifyAdminToken(request))) return unauthorizedResponse(request);

  try {
    const env = getEnv();
    await ensureDBProviders();
    const supportedTypes = paymentRegistry.getSupportedTypes();

    const defaults: Record<string, string> = {
      ENABLED_PAYMENT_TYPES: supportedTypes.join(','),
      DAILY_RECHARGE_LIMIT: String(env.MAX_DAILY_RECHARGE_AMOUNT),
      ORDER_TIMEOUT_MINUTES: String(env.ORDER_TIMEOUT_MINUTES),
      IFRAME_ALLOW_ORIGINS: process.env.IFRAME_ALLOW_ORIGINS ?? '',
      MAX_PENDING_ORDERS: '3',
    };
    if (env.MIN_RECHARGE_AMOUNT !== undefined) defaults.MIN_RECHARGE_AMOUNT = String(env.MIN_RECHARGE_AMOUNT);
    if (env.MAX_RECHARGE_AMOUNT !== undefined) defaults.MAX_RECHARGE_AMOUNT = String(env.MAX_RECHARGE_AMOUNT);
    if (env.RATE_VND !== undefined) defaults.RATE_VND = String(env.RATE_VND);
    if (env.RATE_USDT !== undefined) defaults.RATE_USDT = String(env.RATE_USDT);
    if (env.MIN_RECHARGE_AMOUNT_USDT !== undefined) defaults.MIN_RECHARGE_AMOUNT_USDT = String(env.MIN_RECHARGE_AMOUNT_USDT);
    if (env.MAX_RECHARGE_AMOUNT_USDT !== undefined) defaults.MAX_RECHARGE_AMOUNT_USDT = String(env.MAX_RECHARGE_AMOUNT_USDT);

    return NextResponse.json({
      availablePaymentTypes: supportedTypes,
      defaults,
    });
  } catch (error) {
    console.error('Failed to get env defaults:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Failed to get env defaults' }, { status: 500 });
  }
}
