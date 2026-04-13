import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/config';
import { ORDER_STATUS } from '@/lib/constants';
import { generateRechargeCode } from './code-gen';
import { getMethodDailyLimit } from './limits';
import { getMethodFeeRate, calculatePayAmount } from './fee';
import { ensureDBProviders, paymentRegistry } from '@/lib/payment';
import type { PaymentType, PaymentNotification } from '@/lib/payment';
import {
  getUser,
  createAndRedeem,
  subtractBalance,
  addBalance,
  getGroup,
  getUserSubscriptions,
  extendSubscription,
} from '@/lib/sub2api/client';
import { computeValidityDays, type ValidityUnit } from '@/lib/subscription-utils';
import { Prisma } from '@prisma/client';
import { deriveOrderState, isRefundStatus } from './status';
import { pickLocaleText, type Locale } from '@/lib/locale';
import { getBizDayStartUTC } from '@/lib/time/biz-day';
import { buildOrderResultUrl, createOrderStatusAccessToken } from '@/lib/order/status-access';
import { getSystemConfig, getSystemConfigs } from '@/lib/system-config';
import { selectInstance, getInstanceConfig, type LoadBalanceStrategy } from '@/lib/payment/load-balancer';

/** Maximum amount allowed by Decimal(10,2) */
export const MAX_AMOUNT = 99999999.99;

function message(locale: Locale, vi: string, en: string): string {
  return pickLocaleText(locale, vi, en);
}

export interface CreateOrderInput {
  userId: number;
  amount: number;
  paymentType: PaymentType;
  clientIp: string;
  isMobile?: boolean;
  srcHost?: string;
  srcUrl?: string;
  locale?: Locale;
  // Subscription-specific order types
  orderType?: 'balance' | 'subscription';
  planId?: string;
}

export interface CreateOrderResult {
  orderId: string;
  amount: number;
  payAmount: number;
  feeRate: number;
  status: string;
  paymentType: PaymentType;
  userName: string;
  userBalance: number;
  payUrl?: string | null;
  qrCode?: string | null;
  clientSecret?: string | null;
  expiresAt: Date;
  statusAccessToken: string;
  orderType: 'balance' | 'subscription';
  // SePay bank transfer info
  sepayBankInfo?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    transferCode: string;
  } | null;
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const env = getEnv();
  const locale = input.locale ?? 'en';
  const todayStart = getBizDayStartUTC();
  const orderType = input.orderType ?? 'balance';

  // ── Subscription order pre-validation ──
  let subscriptionPlan: {
    id: string;
    groupId: number | null;
    price: Prisma.Decimal;
    validityDays: number;
    validityUnit: string;
    name: string;
    productName: string | null;
  } | null = null;
  let subscriptionGroupName = '';

  // R6: Balance recharge disabled check
  if (orderType === 'balance') {
    const balanceDisabled = await getSystemConfig('BALANCE_PAYMENT_DISABLED');
    if (balanceDisabled === 'true') {
      throw new OrderError(
        'BALANCE_PAYMENT_DISABLED',
        message(locale, 'Nạp tiền đã bị quản trị viên tắt', 'Balance recharge has been disabled by the administrator'),
        403,
      );
    }
  }

  if (orderType === 'subscription') {
    if (!input.planId) {
      throw new OrderError(
        'INVALID_INPUT',
        message(locale, 'Đơn đăng ký phải chọn gói dịch vụ', 'Subscription order requires a plan'),
        400,
      );
    }
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: input.planId } });
    if (!plan || !plan.forSale) {
      throw new OrderError(
        'PLAN_NOT_AVAILABLE',
        message(locale, 'Gói dịch vụ không tồn tại hoặc chưa mở bán', 'Plan not found or not for sale'),
        404,
      );
    }
    // Validate group binding is valid
    if (plan.groupId === null) {
      throw new OrderError(
        'GROUP_NOT_BOUND',
        message(locale, 'Gói dịch vụ chưa được gắn với nhóm, không thể mua', 'Plan is not bound to a group'),
        400,
      );
    }
    // Validate Sub2API group still exists
    const group = await getGroup(plan.groupId);
    if (!group || group.status !== 'active') {
      throw new OrderError(
        'GROUP_NOT_FOUND',
        message(locale, 'Nhóm đăng ký không còn khả dụng, không thể mua', 'Subscription group is no longer available'),
        410,
      );
    }
    // R4: Validate group must be subscription type
    if (group.subscription_type !== 'subscription') {
      throw new OrderError(
        'GROUP_TYPE_MISMATCH',
        message(locale, 'Nhóm này không phải loại đăng ký, không thể mua đăng ký', 'This group is not a subscription type'),
        400,
      );
    }
    subscriptionGroupName = group?.name || plan.name;
    subscriptionPlan = plan;
    // Subscription order amount uses server-side plan price, don't trust client
    input.amount = Number(plan.price);
  }

  const user = await getUser(input.userId);
  if (user.status !== 'active') {
    throw new OrderError('USER_INACTIVE', message(locale, 'Tài khoản người dùng đã bị vô hiệu hóa', 'User account is disabled'), 422);
  }

  // ── Cancel rate limit: when exceeded, block order creation ──
  const rateLimitConfigs = await getSystemConfigs([
    'CANCEL_RATE_LIMIT_ENABLED',
    'CANCEL_RATE_LIMIT_WINDOW',
    'CANCEL_RATE_LIMIT_UNIT',
    'CANCEL_RATE_LIMIT_MAX',
    'CANCEL_RATE_LIMIT_WINDOW_MODE',
  ]);
  if (rateLimitConfigs['CANCEL_RATE_LIMIT_ENABLED'] === 'true') {
    const windowSize = parseInt(rateLimitConfigs['CANCEL_RATE_LIMIT_WINDOW'] || '1', 10) || 1;
    const maxCount = parseInt(rateLimitConfigs['CANCEL_RATE_LIMIT_MAX'] || '10', 10) || 10;
    const unit = rateLimitConfigs['CANCEL_RATE_LIMIT_UNIT'] || 'day';
    const windowMode = rateLimitConfigs['CANCEL_RATE_LIMIT_WINDOW_MODE'] || 'rolling';

    let windowStart: Date;
    if (windowMode === 'fixed') {
      const now = new Date();
      if (unit === 'day') {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - (windowSize - 1));
        windowStart = start;
      } else if (unit === 'minute') {
        const start = new Date(now);
        start.setSeconds(0, 0);
        start.setMinutes(start.getMinutes() - (windowSize - 1));
        windowStart = start;
      } else {
        const start = new Date(now);
        start.setMinutes(0, 0, 0);
        start.setHours(start.getHours() - (windowSize - 1));
        windowStart = start;
      }
    } else {
      const unitMs = unit === 'minute' ? 60_000 : unit === 'day' ? 86_400_000 : 3_600_000;
      windowStart = new Date(Date.now() - windowSize * unitMs);
    }

    const recentCancelCount = await prisma.auditLog.count({
      where: {
        action: 'ORDER_CANCELLED',
        operator: `user:${input.userId}`,
        createdAt: { gte: windowStart },
      },
    });
    if (recentCancelCount >= maxCount) {
      let retryAfter: Date;
      if (windowMode === 'fixed') {
        const now = new Date();
        if (unit === 'day') {
          retryAfter = new Date(now);
          retryAfter.setHours(0, 0, 0, 0);
          retryAfter.setDate(retryAfter.getDate() + 1);
        } else if (unit === 'minute') {
          retryAfter = new Date(now);
          retryAfter.setSeconds(0, 0);
          retryAfter.setMinutes(retryAfter.getMinutes() + 1);
        } else {
          retryAfter = new Date(now);
          retryAfter.setMinutes(0, 0, 0);
          retryAfter.setHours(retryAfter.getHours() + 1);
        }
      } else {
        const unitMs = unit === 'minute' ? 60_000 : unit === 'day' ? 86_400_000 : 3_600_000;
        const earliest = await prisma.auditLog.findFirst({
          where: {
            action: 'ORDER_CANCELLED',
            operator: `user:${input.userId}`,
            createdAt: { gte: windowStart },
          },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        });
        retryAfter = earliest
          ? new Date(earliest.createdAt.getTime() + windowSize * unitMs)
          : new Date(Date.now() + windowSize * unitMs);
      }

      const waitMs = retryAfter.getTime() - Date.now();
      const retryAfterMinutes = Math.max(1, Math.ceil(waitMs / 60_000));

      throw new OrderError('CANCEL_RATE_LIMITED', 'Cancel rate limited', 429, {
        windowSize,
        unit,
        maxCount,
        retryAfterMinutes,
      });
    }
  }

  const feeRate = getMethodFeeRate(input.paymentType);

  // SePay: input.amount is VND. Convert to credits for Sub2API.
  // amount = credits (what Sub2API receives), payAmount = VND (what user pays)
  let creditAmount = input.amount;
  let payAmountVND = input.amount;
  if (input.paymentType === 'sepay') {
    const vndPerCreditConfig = await getSystemConfig('SEPAY_VND_PER_CREDIT');
    const vndPerCredit = vndPerCreditConfig
      ? parseFloat(vndPerCreditConfig) || 2000
      : env.SEPAY_VND_PER_CREDIT ?? 2000;
    creditAmount = input.amount / vndPerCredit;
    payAmountVND = input.amount; // VND amount (no fee for bank transfer)
  }

  const payAmountStr = input.paymentType === 'sepay'
    ? payAmountVND.toFixed(2)
    : calculatePayAmount(input.amount, feeRate);
  const payAmountNum = Number(payAmountStr);
  const orderAmount = input.paymentType === 'sepay' ? creditAmount : input.amount;

  const orderTimeoutConfig = await getSystemConfig('ORDER_TIMEOUT_MINUTES');
  const defaultTimeoutMinutes = orderTimeoutConfig
    ? parseInt(orderTimeoutConfig, 10) || env.ORDER_TIMEOUT_MINUTES
    : env.ORDER_TIMEOUT_MINUTES;

  // SePay (bank transfer) uses a longer timeout since users need time to manually transfer
  let orderTimeoutMinutes = defaultTimeoutMinutes;
  if (input.paymentType === 'sepay') {
    const sepayTimeoutConfig = await getSystemConfig('SEPAY_ORDER_TIMEOUT_MINUTES');
    orderTimeoutMinutes = sepayTimeoutConfig
      ? parseInt(sepayTimeoutConfig, 10) || 30
      : env.SEPAY_ORDER_TIMEOUT_MINUTES ?? 30;
  }
  const expiresAt = new Date(Date.now() + orderTimeoutMinutes * 60 * 1000);

  // Daily recharge limit config (see /api/user override mode: getSystemConfig → env fallback)
  const dailyLimitConfig = await getSystemConfig('DAILY_RECHARGE_LIMIT');
  const maxDailyRechargeAmount = dailyLimitConfig
    ? parseFloat(dailyLimitConfig) || env.MAX_DAILY_RECHARGE_AMOUNT
    : env.MAX_DAILY_RECHARGE_AMOUNT;

  // Place limit validation and order creation in same serializable transaction to prevent concurrent breakthrough
  const order = await prisma.$transaction(async (tx) => {
    // Daily cumulative recharge limit validation (0 = unlimited)
    if (maxDailyRechargeAmount > 0) {
      const dailyAgg = await tx.order.aggregate({
        where: {
          userId: input.userId,
          status: { in: [ORDER_STATUS.PAID, ORDER_STATUS.RECHARGING, ORDER_STATUS.COMPLETED] },
          paidAt: { gte: todayStart },
        },
        _sum: { amount: true },
      });
      const alreadyPaid = Number(dailyAgg._sum.amount ?? 0);
      if (alreadyPaid + input.amount > maxDailyRechargeAmount) {
        const remaining = Math.max(0, maxDailyRechargeAmount - alreadyPaid);
        throw new OrderError(
          'DAILY_LIMIT_EXCEEDED',
          message(
            locale,
            `Đã đạt giới hạn nạp tiền hôm nay, còn có thể nạp ${remaining.toFixed(0)} VND`,
            `Daily recharge limit reached. Remaining amount: ${remaining.toFixed(0)} VND`,
          ),
          429,
        );
      }
    }

    // Channel daily global limit validation (0 = unlimited)
    const methodDailyLimit = await getMethodDailyLimit(input.paymentType);
    if (methodDailyLimit > 0) {
      const methodAgg = await tx.order.aggregate({
        where: {
          paymentType: input.paymentType,
          status: { in: [ORDER_STATUS.PAID, ORDER_STATUS.RECHARGING, ORDER_STATUS.COMPLETED] },
          paidAt: { gte: todayStart },
        },
        _sum: { amount: true },
      });
      const methodUsed = Number(methodAgg._sum.amount ?? 0);
      if (methodUsed + input.amount > methodDailyLimit) {
        const remaining = Math.max(0, methodDailyLimit - methodUsed);
        throw new OrderError(
          'METHOD_DAILY_LIMIT_EXCEEDED',
          remaining > 0
            ? message(
                locale,
                `Phương thức ${input.paymentType} hôm nay còn lại ${remaining.toFixed(0)} VND, vui lòng giảm số tiền hoặc sử dụng phương thức khác`,
                `${input.paymentType} remaining daily quota: ${remaining.toFixed(0)} VND. Reduce the amount or use another payment method`,
              )
            : message(
                locale,
                `Phương thức ${input.paymentType} hôm nay đã hết hạn mức, vui lòng sử dụng phương thức thanh toán khác`,
                `${input.paymentType} daily quota is full. Please use another payment method`,
              ),
          429,
        );
      }
    }

    const created = await tx.order.create({
      data: {
        userId: input.userId,
        userEmail: user.email,
        userName: user.username,
        userNotes: user.notes || null,
        amount: new Prisma.Decimal(orderAmount.toFixed(2)),
        payAmount: new Prisma.Decimal(payAmountStr),
        feeRate: feeRate > 0 ? new Prisma.Decimal(feeRate.toFixed(4)) : null,
        rechargeCode: '',
        status: 'PENDING',
        paymentType: input.paymentType,
        expiresAt,
        clientIp: input.clientIp,
        srcHost: input.srcHost || null,
        srcUrl: input.srcUrl || null,
        orderType,
        planId: subscriptionPlan?.id ?? null,
        subscriptionGroupId: subscriptionPlan?.groupId ?? null,
        subscriptionDays: subscriptionPlan
          ? computeValidityDays(subscriptionPlan.validityDays, subscriptionPlan.validityUnit as ValidityUnit)
          : null,
      },
    });

    const rechargeCode = generateRechargeCode(created.id);
    await tx.order.update({
      where: { id: created.id },
      data: { rechargeCode },
    });

    return { ...created, rechargeCode };
  });

  try {
    await ensureDBProviders();
    const provider = paymentRegistry.getProvider(input.paymentType);

    // Multi-instance load balancing: select instance for current provider
    let actualProvider = provider;
    let selectedInstanceId: string | undefined;

    const strategyConfig = await getSystemConfig('LOAD_BALANCE_STRATEGY');
    const strategy = (strategyConfig === 'least-amount' ? 'least-amount' : 'round-robin') as LoadBalanceStrategy;

    const instanceResult = await selectInstance(provider.providerKey, strategy, input.paymentType, input.amount);
    if (instanceResult) {
      if (provider.providerKey === 'sepay') {
        const { SepayProvider } = await import('@/lib/providers/sepay');
        actualProvider = new SepayProvider(instanceResult.instanceId, instanceResult.config);
      }
      selectedInstanceId = instanceResult.instanceId;
    } else {
      // Check if configured instances exist but all filtered out by limits
      const instanceCount = await prisma.paymentProviderInstance.count({
        where: { providerKey: provider.providerKey, enabled: true },
      });
      if (instanceCount > 0) {
        throw new OrderError(
          'NO_AVAILABLE_INSTANCE',
          message(
            locale,
            'Không có kênh khả dụng cho phương thức thanh toán này (tất cả thể hiện đã đạt giới hạn), vui lòng thử lại sau hoặc đổi phương thức thanh toán',
            'No available payment instance (all instances have reached their limits). Please try later or use another payment method',
          ),
          429,
        );
      }
    }

    const statusAccessToken = createOrderStatusAccessToken(order.id, input.userId);
    const orderResultUrl = buildOrderResultUrl(env.NEXT_PUBLIC_APP_URL, order.id, input.userId);

    // Only easypay from external notifyUrl, return_url unified back to result page with access token
    let notifyUrl: string | undefined;
    let returnUrl: string | undefined = orderResultUrl;

    // R3+R5: Build payment product name
    let paymentSubject: string;
    if (subscriptionPlan) {
      // R3: Subscription order prioritizes plan custom product name
      paymentSubject = subscriptionPlan.productName || `Sub2API Subscription ${subscriptionGroupName || subscriptionPlan.name}`;
    } else {
      // R5: Balance order uses prefix/suffix config
      const nameConfigs = await getSystemConfigs(['PRODUCT_NAME_PREFIX', 'PRODUCT_NAME_SUFFIX']);
      const prefix = nameConfigs['PRODUCT_NAME_PREFIX']?.trim();
      const suffix = nameConfigs['PRODUCT_NAME_SUFFIX']?.trim();
      if (prefix || suffix) {
        paymentSubject = `${prefix || ''} ${payAmountStr} ${suffix || ''}`.trim();
      } else {
        paymentSubject = `Sub2API ${payAmountStr} VND`;
      }
    }

    const paymentResult = await actualProvider.createPayment({
      orderId: input.paymentType === 'sepay' ? order.rechargeCode : order.id,
      amount: payAmountNum,
      paymentType: input.paymentType,
      subject: paymentSubject,
      notifyUrl,
      returnUrl,
      clientIp: input.clientIp,
      isMobile: input.isMobile,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentTradeNo: paymentResult.tradeNo,
        payUrl: paymentResult.payUrl || null,
        qrCode: paymentResult.qrCode || null,
        providerInstanceId: selectedInstanceId ?? null,
      },
    });

    await prisma.auditLog.create({
      data: {
        orderId: order.id,
        action: 'ORDER_CREATED',
        detail: JSON.stringify({
          userId: input.userId,
          amount: input.amount,
          paymentType: input.paymentType,
          orderType,
          ...(subscriptionPlan && {
            planId: subscriptionPlan.id,
            planName: subscriptionPlan.name,
            groupId: subscriptionPlan.groupId,
          }),
        }),
        operator: `user:${input.userId}`,
      },
    });

    // Build SePay bank transfer info for the frontend
    let sepayBankInfo: CreateOrderResult['sepayBankInfo'] = null;
    if (input.paymentType === 'sepay') {
      const [bankName, accountNumber, accountName] = await Promise.all([
        getSystemConfig('SEPAY_BANK_NAME').then((v) => v || env.SEPAY_BANK_NAME || ''),
        getSystemConfig('SEPAY_BANK_ACCOUNT').then((v) => v || env.SEPAY_BANK_ACCOUNT || ''),
        getSystemConfig('SEPAY_ACCOUNT_NAME').then((v) => v || env.SEPAY_ACCOUNT_NAME || ''),
      ]);
      sepayBankInfo = {
        bankName,
        accountNumber,
        accountName,
        transferCode: order.rechargeCode,
      };
    }

    return {
      orderId: order.id,
      amount: orderAmount,
      payAmount: payAmountNum,
      feeRate,
      status: ORDER_STATUS.PENDING,
      paymentType: input.paymentType,
      userName: user.username,
      userBalance: user.balance,
      payUrl: paymentResult.payUrl,
      qrCode: paymentResult.qrCode,
      expiresAt,
      statusAccessToken,
      sepayBankInfo,
      orderType: input.orderType || 'balance',
    };
  } catch (error) {
    await prisma.order.delete({ where: { id: order.id } });

    // Already a business error, throw directly
    if (error instanceof OrderError) throw error;

    // Payment gateway config missing or call failed, convert to friendly error
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Payment gateway error (${input.paymentType}):`, error);
    if (msg.includes('environment variables') || msg.includes('not configured') || msg.includes('not found')) {
      throw new OrderError(
        'PAYMENT_GATEWAY_ERROR',
        message(
          locale,
          `Phương thức thanh toán (${input.paymentType}) chưa được cấu hình, vui lòng liên hệ quản trị viên`,
          `Payment method (${input.paymentType}) is not configured. Please contact the administrator`,
        ),
        503,
      );
    }
    throw new OrderError(
      'PAYMENT_GATEWAY_ERROR',
      message(
        locale,
        'Phương thức thanh toán tạm thời không khả dụng, vui lòng thử lại sau hoặc sử dụng phương thức khác',
        'Payment method is temporarily unavailable. Please try again later or use another payment method',
      ),
      502,
    );
  }
}

export type CancelOutcome = 'cancelled' | 'already_paid';

/**
 * Core cancel logic — all cancel paths share this.
 * Caller is responsible for permission validation (userId / admin identity) before calling.
 */
export async function cancelOrderCore(options: {
  orderId: string;
  paymentTradeNo: string | null;
  paymentType: string | null;
  providerInstanceId?: string | null;
  finalStatus: 'CANCELLED' | 'EXPIRED';
  operator: string;
  auditDetail: string;
}): Promise<CancelOutcome> {
  const { orderId, paymentTradeNo, paymentType, providerInstanceId, finalStatus, operator, auditDetail } = options;

  // 1. Platform-side processing
  if (paymentTradeNo && paymentType) {
    try {
      let provider;
      // Multi-instance: use instance config to create provider
      if (providerInstanceId) {
        const instConfig = await getInstanceConfig(providerInstanceId);
        if (instConfig) {
          const { SepayProvider } = await import('@/lib/providers/sepay');
          provider = new SepayProvider(providerInstanceId, instConfig);
        }
      }
      if (!provider) {
        await ensureDBProviders();
        provider = paymentRegistry.getProvider(paymentType as PaymentType);
      }
      const queryResult = await provider.queryOrder(paymentTradeNo);

      if (queryResult.status === 'paid') {
        await confirmPayment({
          orderId,
          tradeNo: paymentTradeNo,
          paidAmount: queryResult.amount,
          providerName: provider.name,
        });
        console.log(`Order ${orderId} was paid during cancel (${operator}), processed as success`);
        return 'already_paid';
      }

      if ('cancelPayment' in provider && provider.cancelPayment) {
        try {
          await provider.cancelPayment(paymentTradeNo);
        } catch (cancelErr) {
          console.warn(`Failed to cancel payment for order ${orderId}:`, cancelErr);
        }
      }
    } catch (platformErr) {
      console.warn(`Platform check failed for order ${orderId}, cancelling locally:`, platformErr);
    }
  }

  // 2. DB update (WHERE status='PENDING' ensures idempotency)
  const result = await prisma.order.updateMany({
    where: { id: orderId, status: ORDER_STATUS.PENDING },
    data: { status: finalStatus, updatedAt: new Date() },
  });

  // 3. Audit log
  if (result.count > 0) {
    await prisma.auditLog.create({
      data: {
        orderId,
        action: finalStatus === ORDER_STATUS.EXPIRED ? 'ORDER_EXPIRED' : 'ORDER_CANCELLED',
        detail: auditDetail,
        operator,
      },
    });
  }

  return 'cancelled';
}

export async function cancelOrder(orderId: string, userId: number, locale: Locale = 'en'): Promise<CancelOutcome> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, status: true, paymentTradeNo: true, paymentType: true, providerInstanceId: true },
  });

  if (!order) throw new OrderError('NOT_FOUND', message(locale, 'Đơn hàng không tồn tại', 'Order not found'), 404);
  if (order.userId !== userId) throw new OrderError('FORBIDDEN', message(locale, 'Không có quyền truy cập', 'Forbidden'), 403);
  if (order.status !== ORDER_STATUS.PENDING)
    throw new OrderError('INVALID_STATUS', message(locale, 'Đơn hàng không thể hủy ở trạng thái hiện tại', 'Order cannot be cancelled'), 400);

  return cancelOrderCore({
    orderId: order.id,
    paymentTradeNo: order.paymentTradeNo,
    paymentType: order.paymentType,
    providerInstanceId: order.providerInstanceId,
    finalStatus: ORDER_STATUS.CANCELLED,
    operator: `user:${userId}`,
    auditDetail: message(locale, 'Người dùng đã hủy đơn hàng', 'User cancelled order'),
  });
}

export async function adminCancelOrder(orderId: string, locale: Locale = 'en'): Promise<CancelOutcome> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, paymentTradeNo: true, paymentType: true, providerInstanceId: true },
  });

  if (!order) throw new OrderError('NOT_FOUND', message(locale, 'Đơn hàng không tồn tại', 'Order not found'), 404);
  if (order.status !== ORDER_STATUS.PENDING)
    throw new OrderError('INVALID_STATUS', message(locale, 'Đơn hàng không thể hủy ở trạng thái hiện tại', 'Order cannot be cancelled'), 400);

  return cancelOrderCore({
    orderId: order.id,
    paymentTradeNo: order.paymentTradeNo,
    paymentType: order.paymentType,
    providerInstanceId: order.providerInstanceId,
    finalStatus: ORDER_STATUS.CANCELLED,
    operator: 'admin',
    auditDetail: message(locale, 'Quản trị viên đã hủy đơn hàng', 'Admin cancelled order'),
  });
}

/**
 * Provider-agnostic: confirm a payment and trigger recharge.
 * Called by any provider's webhook/notify handler after verification.
 */
export async function confirmPayment(input: {
  orderId: string;
  tradeNo: string;
  paidAmount: number;
  providerName: string;
}): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
  });
  if (!order) {
    console.error(`${input.providerName} notify: order not found:`, input.orderId);
    return false;
  }

  let paidAmount: Prisma.Decimal;
  try {
    paidAmount = new Prisma.Decimal(input.paidAmount.toFixed(2));
  } catch {
    console.error(`${input.providerName} notify: invalid amount:`, input.paidAmount);
    return false;
  }
  if (paidAmount.lte(0)) {
    console.error(`${input.providerName} notify: non-positive amount:`, input.paidAmount);
    return false;
  }
  const expectedAmount = order.payAmount ?? order.amount;
  if (!paidAmount.equals(expectedAmount)) {
    const diff = paidAmount.minus(expectedAmount).abs();
    if (diff.gt(new Prisma.Decimal('0.01'))) {
      // Write audit log
      await prisma.auditLog.create({
        data: {
          orderId: order.id,
          action: 'PAYMENT_AMOUNT_MISMATCH',
          detail: JSON.stringify({
            expected: expectedAmount.toString(),
            paid: paidAmount.toString(),
            diff: diff.toString(),
            tradeNo: input.tradeNo,
          }),
          operator: input.providerName,
        },
      });
      console.error(
        `${input.providerName} notify: amount mismatch beyond threshold`,
        `expected=${expectedAmount.toString()}, paid=${paidAmount.toString()}, diff=${diff.toString()}`,
      );
      return false;
    }
    console.warn(
      `${input.providerName} notify: minor amount difference (rounding)`,
      expectedAmount.toString(),
      paidAmount.toString(),
    );
  }

  // Only accept PENDING status or EXPIRED orders less than 5 minutes expired (grace window for edge-case completions)
  const graceDeadline = new Date(Date.now() - 5 * 60 * 1000);
  const result = await prisma.order.updateMany({
    where: {
      id: order.id,
      OR: [{ status: ORDER_STATUS.PENDING }, { status: ORDER_STATUS.EXPIRED, updatedAt: { gte: graceDeadline } }],
    },
    data: {
      status: ORDER_STATUS.PAID,
      payAmount: paidAmount,
      paymentTradeNo: input.tradeNo,
      paidAt: new Date(),
      failedAt: null,
      failedReason: null,
    },
  });

  if (result.count === 0) {
    // Requery current status to distinguish "already success" from "needs retry"
    const current = await prisma.order.findUnique({
      where: { id: order.id },
      select: { status: true },
    });
    if (!current) return true;

    // Already completed or refunded — inform payment platform success
    if (current.status === ORDER_STATUS.COMPLETED || current.status === ORDER_STATUS.REFUNDED) {
      return true;
    }

    // FAILED status — previous recharge failed, retry fulfillment using this notification
    if (current.status === ORDER_STATUS.FAILED) {
      try {
        await executeFulfillment(order.id);
        return true;
      } catch (err) {
        console.error('Fulfillment retry failed for order:', order.id, err);
        return false; // Let payment platform retry
      }
    }

    // PAID / RECHARGING — being processed, let payment platform retry later
    if (current.status === ORDER_STATUS.PAID || current.status === ORDER_STATUS.RECHARGING) {
      return false;
    }

    // Other statuses (CANCELLED etc) — shouldn't happen, return true to stop retry
    return true;
  }

  await prisma.auditLog.create({
    data: {
      orderId: order.id,
      action: 'ORDER_PAID',
      detail: JSON.stringify({
        previous_status: order.status,
        trade_no: input.tradeNo,
        expected_amount: order.amount.toString(),
        paid_amount: paidAmount.toString(),
      }),
      operator: input.providerName,
    },
  });

  try {
    await executeFulfillment(order.id);
  } catch (err) {
    console.error('Fulfillment failed for order:', order.id, err);
    return false;
  }

  return true;
}

/**
 * Handle a verified payment notification from any provider.
 * The caller (webhook route) is responsible for verifying the notification
 * via provider.verifyNotification() before calling this function.
 */
export async function handlePaymentNotify(notification: PaymentNotification, providerName: string): Promise<boolean> {
  if (notification.status !== 'success') {
    return true;
  }

  return confirmPayment({
    orderId: notification.orderId,
    tradeNo: notification.tradeNo,
    paidAmount: notification.amount,
    providerName,
  });
}

/**
 * Unified fulfillment entry point — dispatches to balance recharge or subscription allocation based on orderType.
 */
export async function executeFulfillment(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderType: true },
  });
  if (!order) throw new OrderError('NOT_FOUND', 'Order not found', 404);

  if (order.orderType === 'subscription') {
    await executeSubscriptionFulfillment(orderId);
  } else {
    await executeRecharge(orderId);
  }
}

/**
 * Subscription fulfillment — calls Sub2API to allocate subscription after payment succeeds.
 */
export async function executeSubscriptionFulfillment(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new OrderError('NOT_FOUND', 'Order not found', 404);
  if (order.status === ORDER_STATUS.COMPLETED) return;
  if (isRefundStatus(order.status)) {
    throw new OrderError('INVALID_STATUS', 'Refund-related order cannot fulfill', 400);
  }
  if (order.status !== ORDER_STATUS.PAID && order.status !== ORDER_STATUS.FAILED) {
    throw new OrderError('INVALID_STATUS', `Order cannot fulfill in status ${order.status}`, 400);
  }
  if (!order.subscriptionGroupId || !order.subscriptionDays) {
    throw new OrderError('INVALID_STATUS', 'Missing subscription info on order', 400);
  }

  // CAS lock
  const lockResult = await prisma.order.updateMany({
    where: { id: orderId, status: { in: [ORDER_STATUS.PAID, ORDER_STATUS.FAILED] } },
    data: { status: ORDER_STATUS.RECHARGING },
  });
  if (lockResult.count === 0) return;

  try {
    // Validate group still exists
    const group = await getGroup(order.subscriptionGroupId);
    if (!group || group.status !== 'active') {
      throw new Error(`Subscription group ${order.subscriptionGroupId} no longer exists or inactive`);
    }

    // Detect renewal: find active subscription in same group to decide days calculation start point
    let validityDays = order.subscriptionDays;
    let fulfillMethod: 'renew' | 'new' = 'new';
    let renewedSubscriptionId: number | undefined;

    const userSubs = await getUserSubscriptions(order.userId);
    const activeSub = userSubs.find((s) => s.group_id === order.subscriptionGroupId && s.status === 'active');

    if (activeSub) {
      // Renewal: calculate days from expiration date (use order's specific plan, not any plan under group)
      const plan = order.planId
        ? await prisma.subscriptionPlan.findUnique({
            where: { id: order.planId },
            select: { validityDays: true, validityUnit: true },
          })
        : null;
      if (plan) {
        validityDays = computeValidityDays(
          plan.validityDays,
          plan.validityUnit as ValidityUnit,
          new Date(activeSub.expires_at),
        );
      }
      fulfillMethod = 'renew';
      renewedSubscriptionId = activeSub.id;
    }

    await createAndRedeem(
      order.rechargeCode,
      Number(order.amount),
      order.userId,
      `sub2apipay subscription order:${orderId}`,
      {
        type: 'subscription',
        groupId: order.subscriptionGroupId,
        validityDays,
      },
    );

    await prisma.order.updateMany({
      where: { id: orderId, status: ORDER_STATUS.RECHARGING },
      data: { status: ORDER_STATUS.COMPLETED, completedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        orderId,
        action: 'SUBSCRIPTION_SUCCESS',
        detail: JSON.stringify({
          groupId: order.subscriptionGroupId,
          days: order.subscriptionDays,
          amount: Number(order.amount),
          method: fulfillMethod,
          ...(renewedSubscriptionId && { renewedSubscriptionId }),
        }),
        operator: 'system',
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const isGroupGone = reason.includes('no longer exists');

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: ORDER_STATUS.FAILED,
        failedAt: new Date(),
        failedReason: isGroupGone ? `SUBSCRIPTION_GROUP_GONE: ${reason}` : reason,
      },
    });

    await prisma.auditLog.create({
      data: {
        orderId,
        action: 'SUBSCRIPTION_FAILED',
        detail: reason,
        operator: 'system',
      },
    });

    throw error;
  }
}

export async function executeRecharge(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new OrderError('NOT_FOUND', 'Order not found', 404);
  }
  if (order.status === ORDER_STATUS.COMPLETED) {
    return;
  }
  if (isRefundStatus(order.status)) {
    throw new OrderError('INVALID_STATUS', 'Refund-related order cannot recharge', 400);
  }
  if (order.status !== ORDER_STATUS.PAID && order.status !== ORDER_STATUS.FAILED) {
    throw new OrderError('INVALID_STATUS', `Order cannot recharge in status ${order.status}`, 400);
  }

  // Atomic CAS: transition status from PAID/FAILED → RECHARGING to prevent race conditions
  const lockResult = await prisma.order.updateMany({
    where: { id: orderId, status: { in: [ORDER_STATUS.PAID, ORDER_STATUS.FAILED] } },
    data: { status: ORDER_STATUS.RECHARGING },
  });
  if (lockResult.count === 0) {
    // Another concurrent request is already processing
    return;
  }

  try {
    await createAndRedeem(
      order.rechargeCode,
      Number(order.amount),
      order.userId,
      `sub2apipay recharge order:${orderId}`,
    );

    await prisma.order.updateMany({
      where: { id: orderId, status: ORDER_STATUS.RECHARGING },
      data: { status: ORDER_STATUS.COMPLETED, completedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        orderId,
        action: 'RECHARGE_SUCCESS',
        detail: JSON.stringify({ rechargeCode: order.rechargeCode, amount: Number(order.amount) }),
        operator: 'system',
      },
    });
  } catch (error) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: ORDER_STATUS.FAILED,
        failedAt: new Date(),
        failedReason: error instanceof Error ? error.message : String(error),
      },
    });

    await prisma.auditLog.create({
      data: {
        orderId,
        action: 'RECHARGE_FAILED',
        detail: error instanceof Error ? error.message : String(error),
        operator: 'system',
      },
    });

    throw error;
  }
}

function assertRetryAllowed(order: { status: string; paidAt: Date | null }, locale: Locale): void {
  if (!order.paidAt) {
    throw new OrderError(
      'INVALID_STATUS',
      message(locale, 'Đơn hàng chưa được thanh toán, không được phép thử lại', 'Order is not paid, retry denied'),
      400,
    );
  }

  if (isRefundStatus(order.status)) {
    throw new OrderError(
      'INVALID_STATUS',
      message(locale, 'Đơn hàng liên quan đến hoàn tiền không được phép thử lại', 'Refund-related order cannot retry'),
      400,
    );
  }

  if (order.status === ORDER_STATUS.FAILED || order.status === ORDER_STATUS.PAID) {
    return;
  }

  if (order.status === ORDER_STATUS.RECHARGING) {
    throw new OrderError(
      'CONFLICT',
      message(locale, 'Đơn hàng đang được nạp, vui lòng thử lại sau', 'Order is recharging, retry later'),
      409,
    );
  }

  if (order.status === ORDER_STATUS.COMPLETED) {
    throw new OrderError('INVALID_STATUS', message(locale, 'Đơn hàng đã hoàn thành', 'Order already completed'), 400);
  }

  throw new OrderError(
    'INVALID_STATUS',
    message(locale, 'Chỉ cho phép thử lại các đơn hàng đã thanh toán và thất bại', 'Only paid and failed orders can retry'),
    400,
  );
}

export async function retryRecharge(orderId: string, locale: Locale = 'en'): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      paidAt: true,
      completedAt: true,
    },
  });

  if (!order) {
    throw new OrderError('NOT_FOUND', message(locale, 'Đơn hàng không tồn tại', 'Order not found'), 404);
  }

  assertRetryAllowed(order, locale);

  const result = await prisma.order.updateMany({
    where: {
      id: orderId,
      status: { in: [ORDER_STATUS.FAILED, ORDER_STATUS.PAID] },
      paidAt: { not: null },
    },
    data: { status: ORDER_STATUS.PAID, failedAt: null, failedReason: null },
  });

  if (result.count === 0) {
    const latest = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        paidAt: true,
        completedAt: true,
      },
    });

    if (!latest) {
      throw new OrderError('NOT_FOUND', message(locale, 'Đơn hàng không tồn tại', 'Order not found'), 404);
    }

    const derived = deriveOrderState(latest);
    if (derived.rechargeStatus === 'recharging' || latest.status === ORDER_STATUS.PAID) {
      throw new OrderError(
        'CONFLICT',
        message(locale, 'Đơn hàng đang được nạp, vui lòng thử lại sau', 'Order is recharging, retry later'),
        409,
      );
    }

    if (derived.rechargeStatus === 'success') {
      throw new OrderError('INVALID_STATUS', message(locale, 'Đơn hàng đã hoàn thành', 'Order already completed'), 400);
    }

    if (isRefundStatus(latest.status)) {
      throw new OrderError(
        'INVALID_STATUS',
        message(locale, 'Đơn hàng liên quan đến hoàn tiền không được phép thử lại', 'Refund-related order cannot retry'),
        400,
      );
    }

    throw new OrderError(
      'CONFLICT',
      message(locale, 'Trạng thái đơn hàng đã thay đổi, vui lòng làm mới và thử lại', 'Order status changed, refresh and retry'),
      409,
    );
  }

  await prisma.auditLog.create({
    data: {
      orderId,
      action: 'RECHARGE_RETRY',
      detail: message(locale, 'Quản trị viên thử lại nạp tiền thủ công', 'Admin manual retry recharge'),
      operator: 'admin',
    },
  });

  await executeFulfillment(orderId);
}

export interface RefundRequestInput {
  orderId: string;
  userId: number;
  amount: number;
  reason?: string;
  locale?: Locale;
}

export async function requestRefund(input: RefundRequestInput): Promise<{ success: boolean }> {
  const locale = input.locale ?? 'en';
  const order = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order) throw new OrderError('NOT_FOUND', message(locale, 'Đơn hàng không tồn tại', 'Order not found'), 404);
  if (order.userId !== input.userId) {
    throw new OrderError('FORBIDDEN', message(locale, 'Không có quyền yêu cầu hoàn tiền cho đơn hàng này', 'Forbidden'), 403);
  }
  if (order.orderType !== 'balance') {
    throw new OrderError(
      'INVALID_ORDER_TYPE',
      message(locale, 'Chỉ các đơn hàng nạp tiền số dư mới hỗ trợ yêu cầu hoàn tiền', 'Only balance orders can request refund'),
      400,
    );
  }
  if (order.status !== ORDER_STATUS.COMPLETED) {
    throw new OrderError(
      'INVALID_STATUS',
      message(locale, 'Chỉ các đơn hàng đã hoàn thành mới có thể yêu cầu hoàn tiền', 'Only completed orders can request refund'),
      400,
    );
  }

  const refundAmount = input.amount;
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
    throw new OrderError(
      'INVALID_REFUND_AMOUNT',
      message(locale, 'Số tiền hoàn phải lớn hơn 0', 'Refund amount must be greater than 0'),
      400,
    );
  }

  const maxRefundAmount = Number(order.amount);
  if (refundAmount > maxRefundAmount) {
    throw new OrderError(
      'REFUND_AMOUNT_EXCEEDED',
      message(locale, 'Số tiền hoàn không được vượt quá số tiền nạp', 'Refund amount cannot exceed recharge amount'),
      400,
    );
  }

  const user = await getUser(order.userId);
  if (user.balance < refundAmount) {
    throw new OrderError(
      'BALANCE_NOT_ENOUGH',
      message(locale, 'Số tiền hoàn không được vượt quá số dư hiện tại', 'Refund amount cannot exceed current balance'),
      400,
    );
  }

  const normalizedReason = input.reason?.trim() || null;

  const updated = await prisma.order.updateMany({
    where: { id: input.orderId, userId: input.userId, status: ORDER_STATUS.COMPLETED, orderType: 'balance' },
    data: {
      status: ORDER_STATUS.REFUND_REQUESTED,
      refundRequestedAt: new Date(),
      refundRequestReason: normalizedReason,
      refundRequestedBy: input.userId,
      refundAmount: new Prisma.Decimal(refundAmount.toFixed(2)),
    },
  });

  if (updated.count === 0) {
    throw new OrderError(
      'CONFLICT',
      message(locale, 'Trạng thái đơn hàng đã thay đổi, vui lòng làm mới và thử lại', 'Order status changed, refresh and retry'),
      409,
    );
  }

  await prisma.auditLog.create({
    data: {
      orderId: input.orderId,
      action: 'REFUND_REQUESTED',
      detail: JSON.stringify({
        amount: refundAmount,
        reason: normalizedReason,
        requestedBy: input.userId,
      }),
      operator: `user:${input.userId}`,
    },
  });

  return { success: true };
}

export interface RefundInput {
  orderId: string;
  amount?: number;
  reason?: string;
  force?: boolean;
  deductBalance?: boolean;
  locale?: Locale;
}

export interface RefundResult {
  success: boolean;
  warning?: string;
  requireForce?: boolean;
  balanceDeducted?: number;
  subscriptionDaysDeducted?: number;
}

// ── Refund internal types and helper functions ──

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

interface DeductionPlan {
  type: 'balance' | 'subscription' | 'none';
  balanceAmount: number;
  subscriptionDays: number;
  subscriptionId: number | null;
}

/** Query user balance/subscription info, calculate deduction amount. Returns DeductionPlan or early RefundResult. */
async function prepareDeduction(
  order: {
    userId: number;
    orderType: string | null;
    amount: Prisma.Decimal;
    subscriptionGroupId: number | null;
    subscriptionDays: number | null;
  },
  deductBalance: boolean,
  force: boolean,
  locale: Locale,
  overrideAmount?: number,
): Promise<DeductionPlan | RefundResult> {
  if (!deductBalance) return { type: 'none', balanceAmount: 0, subscriptionDays: 0, subscriptionId: null };

  const rechargeAmount = overrideAmount ?? Number(order.amount);

  if (order.orderType === 'subscription') {
    if (!order.subscriptionGroupId || !order.subscriptionDays) {
      return { type: 'subscription', balanceAmount: 0, subscriptionDays: 0, subscriptionId: null };
    }
    try {
      const userSubs = await getUserSubscriptions(order.userId);
      const activeSub = userSubs.find((s) => s.group_id === order.subscriptionGroupId && s.status === 'active');
      if (!activeSub) {
        return { type: 'subscription', balanceAmount: 0, subscriptionDays: 0, subscriptionId: null };
      }
      const remainingDays = Math.max(
        0,
        Math.ceil((new Date(activeSub.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      );
      return {
        type: 'subscription',
        balanceAmount: 0,
        subscriptionDays: Math.min(order.subscriptionDays, remainingDays),
        subscriptionId: activeSub.id,
      };
    } catch {
      if (!force) {
        return {
          success: false,
          warning: message(locale, 'Không thể lấy thông tin đăng ký, vui lòng chọn hoàn tiền cưỡng chế', 'Cannot fetch subscription info, use force'),
          requireForce: true,
        };
      }
      return { type: 'subscription', balanceAmount: 0, subscriptionDays: 0, subscriptionId: null };
    }
  }

  // Balance order
  try {
    const user = await getUser(order.userId);
    return {
      type: 'balance',
      balanceAmount: Math.min(rechargeAmount, user.balance),
      subscriptionDays: 0,
      subscriptionId: null,
    };
  } catch {
    if (!force) {
      return {
        success: false,
        warning: message(locale, 'Không thể lấy số dư người dùng, vui lòng chọn hoàn tiền cưỡng chế', 'Cannot fetch user balance, use force'),
        requireForce: true,
      };
    }
    return { type: 'balance', balanceAmount: 0, subscriptionDays: 0, subscriptionId: null };
  }
}

function isDeductionPlan(v: DeductionPlan | RefundResult): v is DeductionPlan {
  return 'type' in v;
}

/** Execute deduction (the "deduct" step of "deduct then refund") */
async function executeDeduction(orderId: string, userId: number, plan: DeductionPlan): Promise<void> {
  const ts = Date.now();
  if (plan.type === 'subscription' && plan.subscriptionId && plan.subscriptionDays > 0) {
    await extendSubscription(plan.subscriptionId, -plan.subscriptionDays, `sub2apipay:refund-sub:${orderId}:${ts}`);
  } else if (plan.type === 'balance' && plan.balanceAmount > 0) {
    await subtractBalance(
      userId,
      plan.balanceAmount,
      `sub2apipay refund order:${orderId}`,
      `sub2apipay:refund:${orderId}:${ts}`,
    );
  }
}

/** Rollback already deducted balance/subscription. Returns true if rollback succeeds, false if rollback also fails. */
async function rollbackDeduction(
  orderId: string,
  userId: number,
  plan: DeductionPlan,
  gatewayError: unknown,
): Promise<boolean> {
  const ts = Date.now();
  if (plan.type === 'subscription' && plan.subscriptionId && plan.subscriptionDays > 0) {
    try {
      await extendSubscription(
        plan.subscriptionId,
        plan.subscriptionDays,
        `sub2apipay:refund-sub-rollback:${orderId}:${ts}`,
      );
      return true;
    } catch (rollbackError) {
      console.error(
        `[CRITICAL] Subscription rollback failed for order ${orderId}: ${plan.subscriptionDays} days deducted but gateway refund failed. Manual intervention required.`,
      );
      await prisma.auditLog.create({
        data: {
          orderId,
          action: 'REFUND_ROLLBACK_FAILED',
          detail: JSON.stringify({
            gatewayError: errorMessage(gatewayError),
            rollbackError: errorMessage(rollbackError),
            subscriptionDaysDeducted: plan.subscriptionDays,
          }),
          operator: 'admin',
        },
      });
      return false;
    }
  }

  if (plan.type === 'balance' && plan.balanceAmount > 0) {
    try {
      await addBalance(
        userId,
        plan.balanceAmount,
        `sub2apipay refund rollback order:${orderId}`,
        `sub2apipay:refund-rollback:${orderId}:${ts}`,
      );
      return true;
    } catch (rollbackError) {
      console.error(
        `[CRITICAL] Refund rollback failed for order ${orderId}: balance deducted ${plan.balanceAmount} but gateway refund and balance restoration both failed. Manual intervention required.`,
      );
      await prisma.auditLog.create({
        data: {
          orderId,
          action: 'REFUND_ROLLBACK_FAILED',
          detail: JSON.stringify({
            gatewayError: errorMessage(gatewayError),
            rollbackError: errorMessage(rollbackError),
            balanceDeducted: plan.balanceAmount,
            needsBalanceCompensation: true,
          }),
          operator: 'admin',
        },
      });
      return false;
    }
  }

  // No rollback needed (deduction not executed)
  return true;
}

// ── processRefund main flow ──

export async function processRefund(input: RefundInput): Promise<RefundResult> {
  const locale = input.locale ?? 'en';
  const deductBalance = input.deductBalance ?? true;
  const order = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order) throw new OrderError('NOT_FOUND', message(locale, 'Đơn hàng không tồn tại', 'Order not found'), 404);

  const allowedStatuses = [ORDER_STATUS.COMPLETED, ORDER_STATUS.REFUND_REQUESTED, ORDER_STATUS.REFUND_FAILED];
  if (!allowedStatuses.includes(order.status as (typeof allowedStatuses)[number])) {
    throw new OrderError(
      'INVALID_STATUS',
      message(
        locale,
        'Chỉ các đơn hàng đã hoàn thành, đã yêu cầu hoàn tiền hoặc hoàn tiền thất bại mới có thể được hoàn tiền',
        'Only completed, refund-requested, or refund-failed orders can be refunded',
      ),
      400,
    );
  }

  const rechargeAmount = Number(order.amount);
  const maxGatewayRefund = Number(order.payAmount ?? order.amount);

  // Partial refund support: use submitted amount first, otherwise full amount
  const refundAmount = input.amount ?? rechargeAmount;
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
    throw new OrderError(
      'INVALID_REFUND_AMOUNT',
      message(locale, 'Số tiền hoàn phải lớn hơn 0', 'Refund amount must be greater than 0'),
      400,
    );
  }
  if (refundAmount > rechargeAmount) {
    throw new OrderError(
      'REFUND_AMOUNT_EXCEEDED',
      message(locale, 'Số tiền hoàn không được vượt quá số tiền nạp', 'Refund amount cannot exceed recharge amount'),
      400,
    );
  }

  // Gateway refund amount: use refundAmount for partial refund, payAmount for full refund
  const gatewayRefundAmount = input.amount ?? maxGatewayRefund;
  const refundReason =
    input.reason?.trim() || order.refundRequestReason?.trim() || `sub2apipay refund order:${order.id}`;

  // 1. Prepare deduction plan (might return early with requireForce)
  const planOrResult = await prepareDeduction(order, deductBalance, input.force ?? false, locale, input.amount);
  if (!isDeductionPlan(planOrResult)) return planOrResult;
  const plan = planOrResult;

  // 2. CAS optimistic lock
  const lockResult = await prisma.order.updateMany({
    where: {
      id: input.orderId,
      status: { in: [ORDER_STATUS.COMPLETED, ORDER_STATUS.REFUND_REQUESTED, ORDER_STATUS.REFUND_FAILED] },
    },
    data: { status: ORDER_STATUS.REFUNDING },
  });
  if (lockResult.count === 0) {
    throw new OrderError(
      'CONFLICT',
      message(locale, 'Trạng thái đơn hàng đã thay đổi, vui lòng làm mới và thử lại', 'Order status changed, refresh and retry'),
      409,
    );
  }

  try {
    // 3. Execute deduction (safe direction: deduct first then refund)
    await executeDeduction(order.id, order.userId, plan);

    // 4. Call payment gateway refund
    if (order.paymentTradeNo) {
      let provider;
      if (order.providerInstanceId) {
        const instConfig = await getInstanceConfig(order.providerInstanceId);
        if (instConfig) {
          const { SepayProvider } = await import('@/lib/providers/sepay');
          provider = new SepayProvider(order.providerInstanceId, instConfig);
        }
      }
      if (!provider) {
        await ensureDBProviders();
        provider = paymentRegistry.getProvider(order.paymentType as PaymentType);
      }

      try {
        await provider.refund({
          tradeNo: order.paymentTradeNo,
          orderId: order.id,
          amount: gatewayRefundAmount,
          reason: refundReason,
        });
      } catch (gatewayError) {
        // Gateway refund failed — rollback deduction
        const rollbackOk = await rollbackDeduction(input.orderId, order.userId, plan, gatewayError);

        if (rollbackOk) {
          // Rollback successful — restore original status, return failed result (no throw)
          const restoreStatus =
            order.status === ORDER_STATUS.REFUND_REQUESTED ? ORDER_STATUS.REFUND_REQUESTED : ORDER_STATUS.COMPLETED;
          await prisma.order.update({ where: { id: input.orderId }, data: { status: restoreStatus } });
          await prisma.auditLog.create({
            data: {
              orderId: input.orderId,
              action: 'REFUND_GATEWAY_FAILED',
              detail: `Gateway refund failed, deduction rolled back: ${errorMessage(gatewayError)}`,
              operator: 'admin',
            },
          });
          return {
            success: false,
            warning: message(
              locale,
              `Lỗi hoàn tiền: ${errorMessage(gatewayError)}, đã hoàn nguyên trừ`,
              `Gateway refund failed: ${errorMessage(gatewayError)}, deduction rolled back`,
            ),
          };
        }

        // Rollback failed — mark REFUND_FAILED, requires manual intervention
        await prisma.order.update({
          where: { id: input.orderId },
          data: { status: ORDER_STATUS.REFUND_FAILED, failedAt: new Date(), failedReason: errorMessage(gatewayError) },
        });
        await prisma.auditLog.create({
          data: {
            orderId: input.orderId,
            action: 'REFUND_FAILED',
            detail: `Gateway refund failed and rollback also failed: ${errorMessage(gatewayError)}`,
            operator: 'admin',
          },
        });
        throw new OrderError('REFUND_FAILED', errorMessage(gatewayError), 500);
      }
    } else {
      await prisma.auditLog.create({
        data: {
          orderId: input.orderId,
          action: 'REFUND_NO_TRADE_NO',
          detail: 'No paymentTradeNo, skipped gateway refund',
          operator: 'admin',
        },
      });
    }

    // 5. Mark refund as successful (partial/full)
    const finalStatus = refundAmount < rechargeAmount ? ORDER_STATUS.PARTIALLY_REFUNDED : ORDER_STATUS.REFUNDED;

    await prisma.order.update({
      where: { id: input.orderId },
      data: {
        status: finalStatus,
        refundAmount: new Prisma.Decimal(refundAmount.toFixed(2)),
        refundReason: refundReason,
        refundAt: new Date(),
        forceRefund: input.force || false,
      },
    });

    await prisma.auditLog.create({
      data: {
        orderId: input.orderId,
        action: finalStatus === ORDER_STATUS.PARTIALLY_REFUNDED ? 'PARTIAL_REFUND_SUCCESS' : 'REFUND_SUCCESS',
        detail: JSON.stringify({
          rechargeAmount,
          refundAmount,
          gatewayRefundAmount,
          reason: refundReason,
          force: input.force,
          deductBalance,
          balanceDeducted: plan.balanceAmount,
          subscriptionDaysDeducted: plan.subscriptionDays,
        }),
        operator: 'admin',
      },
    });

    return { success: true, balanceDeducted: plan.balanceAmount, subscriptionDaysDeducted: plan.subscriptionDays };
  } catch (error) {
    // Unhandled exceptions (e.g. deduction phase failures) — mark REFUND_FAILED
    if (!(error instanceof OrderError && error.code === 'REFUND_FAILED')) {
      await prisma.order.update({
        where: { id: input.orderId },
        data: { status: ORDER_STATUS.REFUND_FAILED, failedAt: new Date(), failedReason: errorMessage(error) },
      });
      await prisma.auditLog.create({
        data: { orderId: input.orderId, action: 'REFUND_FAILED', detail: errorMessage(error), operator: 'admin' },
      });
    }
    throw error;
  }
}

export class OrderError extends Error {
  code: string;
  statusCode: number;
  data?: Record<string, unknown>;

  constructor(code: string, message: string, statusCode: number = 400, data?: Record<string, unknown>) {
    super(message);
    this.name = 'OrderError';
    this.code = code;
    this.statusCode = statusCode;
    this.data = data;
  }
}
