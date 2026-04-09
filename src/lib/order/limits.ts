import { prisma } from '@/lib/db';
import { ORDER_STATUS } from '@/lib/constants';
import { ensureDBProviders, paymentRegistry } from '@/lib/payment';
import { getMethodFeeRate } from './fee';
import { getBizDayStartUTC } from '@/lib/time/biz-day';
import { getSystemConfig } from '@/lib/system-config';

/**
 * Get daily global limit for specified payment channel (0 = unlimited).
 * Override mode same as /api/user: getSystemConfig (DB → process.env) → provider default.
 * When OVERRIDE_ENV_ENABLED=true and no explicit channel config, skip provider default.
 */
export async function getMethodDailyLimit(paymentType: string): Promise<number> {
  const configVal = await getSystemConfig(`MAX_DAILY_AMOUNT_${paymentType.toUpperCase()}`);
  if (configVal !== undefined) {
    const num = Number(configVal);
    if (Number.isFinite(num) && num >= 0) return num;
  }

  // Override mode enabled → skip provider hardcoded defaults, use global limit
  const overrideEnabled = await getSystemConfig('OVERRIDE_ENV_ENABLED');
  if (overrideEnabled === 'true') return 0;

  // Provider default (fallback when override mode not enabled)
  await ensureDBProviders();
  const providerDefault = paymentRegistry.getDefaultLimit(paymentType);
  if (providerDefault?.dailyMax !== undefined) return providerDefault.dailyMax;

  return 0;
}

/**
 * Get per-transaction limit for specified payment channel (0 = use global MAX_RECHARGE_AMOUNT).
 * Override mode same as /api/user: getSystemConfig (DB → process.env) → provider default.
 * When OVERRIDE_ENV_ENABLED=true and no explicit channel config, skip provider default.
 */
export async function getMethodSingleLimit(paymentType: string): Promise<number> {
  const configVal = await getSystemConfig(`MAX_SINGLE_AMOUNT_${paymentType.toUpperCase()}`);
  if (configVal !== undefined) {
    const num = Number(configVal);
    if (Number.isFinite(num) && num >= 0) return num;
  }

  // Override mode enabled → skip provider hardcoded defaults, use global limit
  const overrideEnabled = await getSystemConfig('OVERRIDE_ENV_ENABLED');
  if (overrideEnabled === 'true') return 0;

  // Provider default (fallback when override mode not enabled)
  await ensureDBProviders();
  const providerDefault = paymentRegistry.getDefaultLimit(paymentType);
  if (providerDefault?.singleMax !== undefined) return providerDefault.singleMax;

  return 0;
}

export interface MethodLimitStatus {
  dailyLimit: number;
  used: number;
  remaining: number | null;
  available: boolean;
  singleMin: number;
  singleMax: number;
  feeRate: number;
}

interface InstanceChannelLimits {
  dailyLimit?: number;
  singleMin?: number;
  singleMax?: number;
}

/**
 * Aggregate instance-level limits: for each payment type, get the most lenient single amount range from all instances + check daily limit availability.
 * When remaining daily quota < instance's singleMin, that instance is considered unavailable.
 */
async function aggregateInstanceLimits(paymentTypes: string[]): Promise<
  Record<
    string,
    {
      singleMin: number;
      singleMax: number;
      allInstancesDailyBlocked: boolean;
      maxRemainingCapacity: number | null;
      hasInstances: boolean;
    }
  >
> {
  const result: Record<
    string,
    {
      singleMin: number;
      singleMax: number;
      allInstancesDailyBlocked: boolean;
      maxRemainingCapacity: number | null;
      hasInstances: boolean;
    }
  > = {};

  const allInstances = await prisma.paymentProviderInstance.findMany({
    where: { enabled: true },
    select: { id: true, limits: true, supportedTypes: true },
  });

  if (allInstances.length === 0) {
    for (const type of paymentTypes) {
      result[type] = {
        singleMin: 0,
        singleMax: 0,
        allInstancesDailyBlocked: false,
        maxRemainingCapacity: null,
        hasInstances: false,
      };
    }
    return result;
  }

  const todayStart = getBizDayStartUTC();

  const usageRows = await prisma.order.groupBy({
    by: ['providerInstanceId'],
    where: {
      providerInstanceId: { in: allInstances.map((i) => i.id) },
      status: { in: [ORDER_STATUS.PAID, ORDER_STATUS.RECHARGING, ORDER_STATUS.COMPLETED] },
      paidAt: { gte: todayStart },
    },
    _sum: { payAmount: true },
  });
  const usageMap = new Map(usageRows.map((r) => [r.providerInstanceId, Number(r._sum.payAmount ?? 0)]));

  for (const type of paymentTypes) {
    const supporting = allInstances.filter((inst) => {
      if (!inst.supportedTypes) return true;
      const types = inst.supportedTypes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return types.length === 0 || types.includes(type);
    });

    if (supporting.length === 0) {
      result[type] = {
        singleMin: 0,
        singleMax: 0,
        allInstancesDailyBlocked: false,
        maxRemainingCapacity: null,
        hasInstances: false,
      };
      continue;
    }

    let aggSingleMin = Infinity;
    let aggSingleMax = 0;
    let allBlocked = true;
    let maxRemaining: number | null = null; // Maximum remaining daily quota among all available instances

    for (const inst of supporting) {
      let channelLimits: InstanceChannelLimits | undefined;
      if (inst.limits) {
        try {
          const parsed = JSON.parse(inst.limits) as Record<string, InstanceChannelLimits>;
          channelLimits = parsed[type];
        } catch {
          /* ignore */
        }
      }

      // Per-transaction range: get most lenient range from all instances
      const instMin = channelLimits?.singleMin ?? 0;
      const instMax = channelLimits?.singleMax ?? 0;
      if (instMin > 0 && instMin < aggSingleMin) aggSingleMin = instMin;
      if (instMin === 0) aggSingleMin = 0;
      if (instMax > aggSingleMax) aggSingleMax = instMax;
      if (instMax === 0) aggSingleMax = 0;

      // Daily limit: calculate remaining capacity, check if available
      const instDailyLimit = channelLimits?.dailyLimit;
      if (!instDailyLimit || instDailyLimit <= 0) {
        // No daily limit restriction
        allBlocked = false;
        maxRemaining = null; // null means at least one instance has no limit
      } else {
        const used = usageMap.get(inst.id) ?? 0;
        const remaining = Math.max(0, instDailyLimit - used);
        const effectiveMin = instMin > 0 ? instMin : 0;

        if (remaining > effectiveMin) {
          // Remaining quota sufficient for next order (greater than minimum per transaction)
          allBlocked = false;
          if (maxRemaining !== null) {
            maxRemaining = Math.max(maxRemaining, remaining);
          }
          // When maxRemaining === null, an unlimited instance exists, keep null
        }
        // remaining <= effectiveMin: this instance is effectively unavailable, doesn't affect allBlocked
      }
    }

    if (aggSingleMin === Infinity) aggSingleMin = 0;

    result[type] = {
      singleMin: aggSingleMin,
      singleMax: aggSingleMax,
      allInstancesDailyBlocked: allBlocked,
      maxRemainingCapacity: maxRemaining,
      hasInstances: true,
    };
  }

  return result;
}

/**
 * Query today's usage for multiple payment channels in batch.
 * Aggregate global limits + instance-level limits, return in one call with availability info needed by frontend.
 */
export async function queryMethodLimits(paymentTypes: string[]): Promise<Record<string, MethodLimitStatus>> {
  const todayStart = getBizDayStartUTC();

  const [usageRows, instanceAgg] = await Promise.all([
    prisma.order.groupBy({
      by: ['paymentType'],
      where: {
        paymentType: { in: paymentTypes },
        status: { in: [ORDER_STATUS.PAID, ORDER_STATUS.RECHARGING, ORDER_STATUS.COMPLETED] },
        paidAt: { gte: todayStart },
      },
      _sum: { amount: true },
    }),
    aggregateInstanceLimits(paymentTypes),
  ]);

  const usageMap = Object.fromEntries(usageRows.map((row) => [row.paymentType, Number(row._sum.amount ?? 0)]));

  const result: Record<string, MethodLimitStatus> = {};
  for (const type of paymentTypes) {
    const globalDailyLimit = await getMethodDailyLimit(type);
    const globalSingleMax = await getMethodSingleLimit(type);
    const feeRate = getMethodFeeRate(type);
    const used = usageMap[type] ?? 0;
    const remaining = globalDailyLimit > 0 ? Math.max(0, globalDailyLimit - used) : null;

    const inst = instanceAgg[type];
    // Global available: global daily limit not exceeded
    const globalAvailable = globalDailyLimit === 0 || used < globalDailyLimit;
    // Instance available: no instances (use env var provider) or not all instances blocked by daily limit
    const instanceAvailable = !inst?.hasInstances || !inst.allInstancesDailyBlocked;

    // Aggregate per-transaction range: intersection of instance-level and global limits
    const singleMin = inst?.singleMin ?? 0;
    let singleMax = globalSingleMax;
    if (inst?.hasInstances && inst.singleMax > 0) {
      singleMax = singleMax > 0 ? Math.min(singleMax, inst.singleMax) : inst.singleMax;
    }

    // Instance remaining daily capacity constraint: singleMax cannot exceed max remaining capacity
    if (inst?.hasInstances && inst.maxRemainingCapacity !== null && inst.maxRemainingCapacity >= 0) {
      singleMax = singleMax > 0 ? Math.min(singleMax, inst.maxRemainingCapacity) : inst.maxRemainingCapacity;
    }

    // Global remaining daily capacity constraint
    if (remaining !== null && remaining >= 0) {
      singleMax = singleMax > 0 ? Math.min(singleMax, remaining) : remaining;
    }

    // Final availability: if singleMax < singleMin, channel is effectively unavailable
    const effectivelyAvailable = globalAvailable && instanceAvailable && (singleMin === 0 || singleMax >= singleMin);

    result[type] = {
      dailyLimit: globalDailyLimit,
      used,
      remaining,
      available: effectivelyAvailable,
      singleMin,
      singleMax,
      feeRate,
    };
  }
  return result;
}
