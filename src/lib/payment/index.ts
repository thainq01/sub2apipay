import { paymentRegistry } from './registry';
import { SepayProvider } from '@/lib/providers/sepay';
import { getEnv } from '@/lib/config';
import { getSystemConfig } from '@/lib/system-config';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/crypto';

export { paymentRegistry } from './registry';
export type {
  PaymentType,
  PaymentProvider,
  CreatePaymentRequest,
  CreatePaymentResponse,
  QueryOrderResponse,
  PaymentNotification,
  RefundRequest,
  RefundResponse,
} from './types';

let initialized = false;
const registeredKeys = new Set<string>();

type Env = ReturnType<typeof getEnv>;

function registerFromList(providers: string[], env: Env, strict: boolean): void {
  if (providers.includes('sepay') && !registeredKeys.has('sepay')) {
    if (!env.SEPAY_API_KEY) {
      if (strict) throw new Error('PAYMENT_PROVIDERS includes sepay, but SEPAY_API_KEY is missing');
      console.warn('[payment] sepay enabled in DB but SEPAY_API_KEY not set, skipping');
    } else {
      paymentRegistry.register(new SepayProvider());
      registeredKeys.add('sepay');
    }
  }
}

export function initPaymentProviders(): void {
  if (initialized) return;
  const env = getEnv();
  registerFromList(env.PAYMENT_PROVIDERS, env, true);
  initialized = true;
}

/**
 * Async init: when database override mode is enabled, register additional providers based on ENABLED_PROVIDERS.
 * For providers with active instances and keys in instance config, can register even without environment variables.
 */
export async function ensureDBProviders(): Promise<void> {
  initPaymentProviders();

  const overrideEnabled = await getSystemConfig('OVERRIDE_ENV_ENABLED');
  if (overrideEnabled !== 'true') return;

  const enabledProvidersRaw = await getSystemConfig('ENABLED_PROVIDERS');
  if (!enabledProvidersRaw) return;

  const dbProviders = enabledProvidersRaw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const env = getEnv();

  // First register from environment variables
  registerFromList(dbProviders, env, false);

  // For providers with missing env vars but active instances, register from instance config
  for (const key of dbProviders) {
    if (registeredKeys.has(key)) continue;

    const instance = await prisma.paymentProviderInstance.findFirst({
      where: { providerKey: key, enabled: true },
      select: { id: true, config: true },
    });
    if (!instance) continue;

    let config: Record<string, string>;
    try {
      config = JSON.parse(decrypt(instance.config));
    } catch {
      console.warn(`[payment] Failed to decrypt config for ${key} instance ${instance.id}, skipping`);
      continue;
    }

    switch (key) {
      case 'sepay':
        if (config.apiKey) {
          paymentRegistry.register(new SepayProvider(instance.id, config));
          registeredKeys.add(key);
        }
        break;
    }
  }
}

// Inject lazy init: Registry methods will automatically call initPaymentProviders() (sync fallback)
paymentRegistry.setInitializer(initPaymentProviders);
