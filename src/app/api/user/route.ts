import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserByToken } from '@/lib/sub2api/client';
import { getEnv } from '@/lib/config';
import { queryMethodLimits } from '@/lib/order/limits';
import { ensureDBProviders, paymentRegistry } from '@/lib/payment';
import { getPaymentDisplayInfo } from '@/lib/pay-utils';
import { resolveLocale } from '@/lib/locale';
import { getSystemConfig, getRequiredNumericConfig } from '@/lib/system-config';
import { resolveEnabledPaymentTypes } from '@/lib/payment/resolve-enabled-types';

export async function GET(request: NextRequest) {
  const locale = resolveLocale(request.nextUrl.searchParams.get('lang'));
  const userId = Number(request.nextUrl.searchParams.get('user_id'));
  if (!userId || isNaN(userId) || userId <= 0) {
    return NextResponse.json({ error: locale === 'vi' ? 'ID người dùng không hợp lệ' : 'Invalid user ID' }, { status: 400 });
  }

  const token = request.nextUrl.searchParams.get('token')?.trim();
  if (!token) {
    return NextResponse.json(
      { error: locale === 'vi' ? 'Thiếu tham số token' : 'Missing token parameter' },
      { status: 401 },
    );
  }

  try {
    // Verify token and ensure requested user_id matches the token's user
    let tokenUser;
    try {
      tokenUser = await getCurrentUserByToken(token);
    } catch {
      return NextResponse.json({ error: locale === 'vi' ? 'Token không hợp lệ' : 'Invalid token' }, { status: 401 });
    }

    if (tokenUser.id !== userId) {
      return NextResponse.json(
        { error: locale === 'vi' ? 'Không có quyền truy cập người dùng này' : 'Forbidden to access this user' },
        { status: 403 },
      );
    }

    const env = getEnv();
    await ensureDBProviders();
    const supportedTypes = paymentRegistry.getSupportedTypes();

    // Parallel getUser and config queries; start queryMethodLimits immediately after config completes
    const configPromise = Promise.all([
      getSystemConfig('ENABLED_PAYMENT_TYPES'),
      getSystemConfig('BALANCE_PAYMENT_DISABLED'),
      getSystemConfig('MAX_PENDING_ORDERS'),
      getSystemConfig('DAILY_RECHARGE_LIMIT'),
      getRequiredNumericConfig('MIN_RECHARGE_AMOUNT'),
      getRequiredNumericConfig('MAX_RECHARGE_AMOUNT'),
      getRequiredNumericConfig('RATE_VND'),
      getRequiredNumericConfig('RATE_USDT'),
      getRequiredNumericConfig('MIN_RECHARGE_AMOUNT_USDT'),
      getRequiredNumericConfig('MAX_RECHARGE_AMOUNT_USDT'),
    ]).then(
      async ([
        configuredPaymentTypesRaw,
        balanceDisabledVal,
        maxPendingVal,
        dailyLimitVal,
        minAmount,
        maxAmount,
        rate,
        rateUsdt,
        minAmountUsdt,
        maxAmountUsdt,
      ]) => {
        const enabledTypes = resolveEnabledPaymentTypes(supportedTypes, configuredPaymentTypesRaw);

        const methodLimits = await queryMethodLimits(enabledTypes);
        return {
          enabledTypes,
          methodLimits,
          balanceDisabled: balanceDisabledVal === 'true',
          maxPendingOrders: maxPendingVal ? parseInt(maxPendingVal, 10) || 3 : 3,
          minAmount,
          maxAmount,
          maxDailyAmount: dailyLimitVal ? parseFloat(dailyLimitVal) : env.MAX_DAILY_RECHARGE_AMOUNT,
          rate,
          rateUsdt,
          minAmountUsdt,
          maxAmountUsdt,
        };
      },
    );

    const { enabledTypes, methodLimits, balanceDisabled, maxPendingOrders, minAmount, maxAmount, maxDailyAmount, rate, rateUsdt, minAmountUsdt, maxAmountUsdt } =
      await configPromise;

    // Collect sublabel overrides
    const sublabelOverrides: Record<string, string> = {};

    // 1. Detect same label conflicts: multiple enabled channels with same display name, auto mark default sublabel (provider name)
    const labelCount = new Map<string, string[]>();
    for (const type of enabledTypes) {
      const { channel } = getPaymentDisplayInfo(type, locale);
      const types = labelCount.get(channel) || [];
      types.push(type);
      labelCount.set(channel, types);
    }
    for (const [, types] of labelCount) {
      if (types.length > 1) {
        for (const type of types) {
          const { provider } = getPaymentDisplayInfo(type, locale);
          if (provider) sublabelOverrides[type] = provider;
        }
      }
    }

    // 2. Manually configured PAYMENT_SUBLABEL_* has highest priority, overrides auto-generated
    if (env.PAYMENT_SUBLABEL_SEPAY) sublabelOverrides.sepay = env.PAYMENT_SUBLABEL_SEPAY;

    return NextResponse.json({
      user: {
        id: tokenUser.id,
        status: tokenUser.status,
      },
      config: {
        enabledPaymentTypes: enabledTypes,
        minAmount,
        maxAmount,
        maxDailyAmount,
        methodLimits,
        helpImageUrl: env.PAY_HELP_IMAGE_URL ?? null,
        helpText: env.PAY_HELP_TEXT ?? null,
        balanceDisabled,
        maxPendingOrders,
        sublabelOverrides: Object.keys(sublabelOverrides).length > 0 ? sublabelOverrides : null,
        rate,
        rateUsdt,
        minAmountUsdt,
        maxAmountUsdt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: locale === 'vi' ? 'Người dùng không tồn tại' : 'User not found' }, { status: 404 });
    }
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: locale === 'vi' ? 'Lỗi lấy thông tin người dùng' : 'Failed to fetch user info' },
      { status: 500 },
    );
  }
}
