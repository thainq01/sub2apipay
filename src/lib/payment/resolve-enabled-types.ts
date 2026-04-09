import { getSystemConfig } from '@/lib/system-config';
import { ensureDBProviders, paymentRegistry } from '@/lib/payment';

/**
 * Filter supported payment types based on ENABLED_PAYMENT_TYPES configuration.
 * Falls back to all supported types when configuredTypes is undefined or empty.
 */
export function resolveEnabledPaymentTypes(supportedTypes: string[], configuredTypes: string | undefined): string[] {
  if (configuredTypes === undefined) return supportedTypes;

  const configuredTypeSet = new Set(
    configuredTypes
      .split(',')
      .map((type) => type.trim())
      .filter(Boolean),
  );
  if (configuredTypeSet.size === 0) return supportedTypes;

  return supportedTypes.filter((type) => configuredTypeSet.has(type));
}

/**
 * Get currently enabled payment types (combines registry supported types + database ENABLED_PAYMENT_TYPES config).
 */
export async function getEnabledPaymentTypes(): Promise<string[]> {
  await ensureDBProviders();
  const supportedTypes = paymentRegistry.getSupportedTypes();
  const configuredTypes = await getSystemConfig('ENABLED_PAYMENT_TYPES');
  return resolveEnabledPaymentTypes(supportedTypes, configuredTypes);
}
