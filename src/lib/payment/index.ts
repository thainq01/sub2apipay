import { paymentRegistry } from './registry';
import type { PaymentType } from './types';
import { EasyPayProvider } from '@/lib/easy-pay/provider';
import { StripeProvider } from '@/lib/stripe/provider';
import { AlipayProvider } from '@/lib/alipay/provider';
import { WxpayProvider } from '@/lib/wxpay/provider';
import { SepayProvider } from '@/lib/sepay/provider';
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
  if (providers.includes('easypay') && !registeredKeys.has('easypay')) {
    if (!env.EASY_PAY_PID || !env.EASY_PAY_PKEY) {
      if (strict) throw new Error('PAYMENT_PROVIDERS includes easypay, but EASY_PAY_PID or EASY_PAY_PKEY is missing');
      console.warn('[payment] easypay enabled in DB but EASY_PAY_PID/EASY_PAY_PKEY not set, skipping');
    } else {
      paymentRegistry.register(new EasyPayProvider());
      registeredKeys.add('easypay');
    }
  }

  if (providers.includes('alipay') && !registeredKeys.has('alipay')) {
    if (!env.ALIPAY_APP_ID || !env.ALIPAY_PRIVATE_KEY || !env.ALIPAY_NOTIFY_URL) {
      if (strict)
        throw new Error(
          'PAYMENT_PROVIDERS includes alipay but required env vars are missing: ALIPAY_APP_ID, ALIPAY_PRIVATE_KEY, ALIPAY_NOTIFY_URL',
        );
      console.warn('[payment] alipay enabled in DB but required env vars not set, skipping');
    } else {
      paymentRegistry.register(new AlipayProvider());
      registeredKeys.add('alipay');
    }
  }

  if (providers.includes('wxpay') && !registeredKeys.has('wxpay')) {
    if (
      !env.WXPAY_APP_ID ||
      !env.WXPAY_MCH_ID ||
      !env.WXPAY_PRIVATE_KEY ||
      !env.WXPAY_API_V3_KEY ||
      !env.WXPAY_PUBLIC_KEY ||
      !env.WXPAY_PUBLIC_KEY_ID ||
      !env.WXPAY_CERT_SERIAL ||
      !env.WXPAY_NOTIFY_URL
    ) {
      if (strict)
        throw new Error(
          'PAYMENT_PROVIDERS includes wxpay but required env vars are missing: WXPAY_APP_ID, WXPAY_MCH_ID, WXPAY_PRIVATE_KEY, WXPAY_API_V3_KEY, WXPAY_PUBLIC_KEY, WXPAY_PUBLIC_KEY_ID, WXPAY_CERT_SERIAL, WXPAY_NOTIFY_URL',
        );
      console.warn('[payment] wxpay enabled in DB but required env vars not set, skipping');
    } else {
      paymentRegistry.register(new WxpayProvider());
      registeredKeys.add('wxpay');
    }
  }

  if (providers.includes('stripe') && !registeredKeys.has('stripe')) {
    if (!env.STRIPE_SECRET_KEY) {
      if (strict) throw new Error('PAYMENT_PROVIDERS includes stripe, but STRIPE_SECRET_KEY is missing');
      console.warn('[payment] stripe enabled in DB but STRIPE_SECRET_KEY not set, skipping');
    } else {
      paymentRegistry.register(new StripeProvider());
      registeredKeys.add('stripe');
    }
  }

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
 * Call in all async entry points using paymentRegistry.
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
      case 'stripe':
        if (config.secretKey) {
          paymentRegistry.register(new StripeProvider(instance.id, config));
          registeredKeys.add(key);
        } else {
          console.warn(`[payment] stripe instance ${instance.id} has no secretKey, skipping`);
        }
        break;
      case 'easypay':
        if (config.pid && config.pkey) {
          paymentRegistry.register(new EasyPayProvider(instance.id, config));
          registeredKeys.add(key);
        }
        break;
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
