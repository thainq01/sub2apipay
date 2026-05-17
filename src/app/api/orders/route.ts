import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createOrder } from '@/lib/order/service';
import { getEnabledPaymentTypes } from '@/lib/payment/resolve-enabled-types';
import { getCurrentUserByToken } from '@/lib/sub2api/client';
import { handleApiError } from '@/lib/utils/api';
import { getRequiredNumericConfig } from '@/lib/system-config';

const createOrderSchema = z.object({
  token: z.string().min(1),
  amount: z.number().positive().max(99999999.99),
  payment_type: z.string().min(1),
  src_host: z.string().max(253).optional(),
  src_url: z
    .string()
    .max(2048)
    .refine((url) => {
      try {
        const protocol = new URL(url).protocol;
        return protocol === 'http:' || protocol === 'https:';
      } catch {
        return false;
      }
    }, 'src_url must be a valid HTTP/HTTPS URL')
    .optional(),
  is_mobile: z.boolean().optional(),
  order_type: z.enum(['balance', 'subscription']).optional(),
  plan_id: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { token, amount, payment_type, src_host, src_url, is_mobile, order_type, plan_id } = parsed.data;

    // Resolve user identity from token
    let userId: number;
    try {
      const user = await getCurrentUserByToken(token);
      userId = user.id;
    } catch {
      return NextResponse.json({ error: 'Invalid token, please login again', code: 'INVALID_TOKEN' }, { status: 401 });
    }

    // Subscription orders skip amount range validation (price determined by server plan)
    if (order_type !== 'subscription') {
      // Recharge limits are stored as coffee-cup counts (credits), not currency amounts.
      // input.amount is VND from the frontend; divide by RATE_VND to get the cup count,
      // then compare against the appropriate per-payment-type cup limit.
      const rateVnd = await getRequiredNumericConfig('RATE_VND');
      const cups = amount / rateVnd;
      if (payment_type === 'bsc-usdt') {
        const minCups = await getRequiredNumericConfig('MIN_RECHARGE_AMOUNT_USDT');
        const maxCups = await getRequiredNumericConfig('MAX_RECHARGE_AMOUNT_USDT');
        if (cups < minCups || cups > maxCups) {
          return NextResponse.json(
            { error: `Recharge must be between ${minCups} and ${maxCups} coffee cups (USDT payment)` },
            { status: 400 },
          );
        }
      } else {
        const minCups = await getRequiredNumericConfig('MIN_RECHARGE_AMOUNT');
        const maxCups = await getRequiredNumericConfig('MAX_RECHARGE_AMOUNT');
        if (cups < minCups || cups > maxCups) {
          return NextResponse.json(
            { error: `Recharge must be between ${minCups} and ${maxCups} coffee cups (VND payment)` },
            { status: 400 },
          );
        }
      }
    }

    // Validate payment type is enabled (registry + ENABLED_PAYMENT_TYPES config)
    const enabledTypes = await getEnabledPaymentTypes();
    if (!enabledTypes.includes(payment_type)) {
      return NextResponse.json({ error: `Unsupported payment method: ${payment_type}` }, { status: 400 });
    }

    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';

    const result = await createOrder({
      userId,
      amount,
      paymentType: payment_type,
      clientIp,
      isMobile: is_mobile,
      srcHost: src_host,
      srcUrl: src_url,
      orderType: order_type,
      planId: plan_id,
    });

    // Don't expose private fields like userName / userBalance to client
    const { userName: _u, userBalance: _b, ...safeResult } = result;
    return NextResponse.json(safeResult);
  } catch (error) {
    return handleApiError(error, 'Failed to create order');
  }
}
