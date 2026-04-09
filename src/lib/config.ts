import { z } from 'zod';
import fs from 'fs';

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}, z.string().optional());

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),

  SUB2API_BASE_URL: z.string().url(),
  SUB2API_ADMIN_API_KEY: z.string().min(1),

  // Payment service providers (explicitly declare which to enable, comma-separated: easypay, alipay, wxpay, stripe)
  PAYMENT_PROVIDERS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),

  // Easy-Pay (required when PAYMENT_PROVIDERS contains easypay)
  EASY_PAY_PID: optionalTrimmedString,
  EASY_PAY_PKEY: optionalTrimmedString,
  EASY_PAY_API_BASE: optionalTrimmedString,
  EASY_PAY_NOTIFY_URL: optionalTrimmedString,
  EASY_PAY_RETURN_URL: optionalTrimmedString,
  EASY_PAY_CID: optionalTrimmedString,
  EASY_PAY_CID_ALIPAY: optionalTrimmedString,
  EASY_PAY_CID_WXPAY: optionalTrimmedString,

  // Direct Alipay (required when PAYMENT_PROVIDERS contains alipay)
  // Supports key content directly or file path (automatically reads)
  ALIPAY_APP_ID: optionalTrimmedString,
  ALIPAY_PRIVATE_KEY: optionalTrimmedString,
  ALIPAY_PUBLIC_KEY: optionalTrimmedString,
  ALIPAY_NOTIFY_URL: optionalTrimmedString,
  ALIPAY_RETURN_URL: optionalTrimmedString,

  // Direct WeChat Pay (required when PAYMENT_PROVIDERS contains wxpay)
  WXPAY_APP_ID: optionalTrimmedString,
  WXPAY_MCH_ID: optionalTrimmedString,
  WXPAY_PRIVATE_KEY: optionalTrimmedString,
  WXPAY_CERT_SERIAL: optionalTrimmedString,
  WXPAY_API_V3_KEY: optionalTrimmedString,
  WXPAY_NOTIFY_URL: optionalTrimmedString,
  WXPAY_PUBLIC_KEY: optionalTrimmedString,
  WXPAY_PUBLIC_KEY_ID: optionalTrimmedString,

  // Stripe (required when PAYMENT_PROVIDERS contains stripe)
  STRIPE_SECRET_KEY: optionalTrimmedString,
  STRIPE_PUBLISHABLE_KEY: optionalTrimmedString,
  STRIPE_WEBHOOK_SECRET: optionalTrimmedString,

  // SePay (required when PAYMENT_PROVIDERS contains sepay)
  SEPAY_API_KEY: optionalTrimmedString,
  SEPAY_BANK_ACCOUNT: optionalTrimmedString,
  SEPAY_BANK_NAME: optionalTrimmedString,
  SEPAY_ACCOUNT_NAME: optionalTrimmedString,
  SEPAY_ORDER_TIMEOUT_MINUTES: z.string().default('30').transform(Number).pipe(z.number().int().positive()).optional(),
  // VND per 1 credit on Sub2API (e.g., 2000 means 2000 VND = 1 credit)
  SEPAY_VND_PER_CREDIT: z.string().default('2000').transform(Number).pipe(z.number().positive()).optional(),

  ORDER_TIMEOUT_MINUTES: z.string().default('5').transform(Number).pipe(z.number().int().positive()),
  MIN_RECHARGE_AMOUNT: z.string().default('1').transform(Number).pipe(z.number().positive()),
  MAX_RECHARGE_AMOUNT: z.string().default('1000').transform(Number).pipe(z.number().positive()),
  // Daily cumulative max recharge per user, 0 = unlimited
  MAX_DAILY_RECHARGE_AMOUNT: z.string().default('10000').transform(Number).pipe(z.number().min(0)),

  // Daily global limit per channel, can override (0 = unlimited)
  // When not set, default values from PaymentProvider.defaultLimits are used
  MAX_DAILY_AMOUNT_ALIPAY: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? Number(v) : undefined))
    .pipe(z.number().min(0).optional()),
  MAX_DAILY_AMOUNT_ALIPAY_DIRECT: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? Number(v) : undefined))
    .pipe(z.number().min(0).optional()),
  MAX_DAILY_AMOUNT_WXPAY: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? Number(v) : undefined))
    .pipe(z.number().min(0).optional()),
  MAX_DAILY_AMOUNT_STRIPE: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? Number(v) : undefined))
    .pipe(z.number().min(0).optional()),
  MAX_DAILY_AMOUNT_SEPAY: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? Number(v) : undefined))
    .pipe(z.number().min(0).optional()),
  ADMIN_TOKEN: z.string().min(16),

  NEXT_PUBLIC_APP_URL: z.string().url(),
  PAY_HELP_IMAGE_URL: optionalTrimmedString,
  PAY_HELP_TEXT: optionalTrimmedString,

  // Payment method frontend description (sublabel) override, use default if not set
  PAYMENT_SUBLABEL_ALIPAY: optionalTrimmedString,
  PAYMENT_SUBLABEL_ALIPAY_DIRECT: optionalTrimmedString,
  PAYMENT_SUBLABEL_WXPAY: optionalTrimmedString,
  PAYMENT_SUBLABEL_WXPAY_DIRECT: optionalTrimmedString,
  PAYMENT_SUBLABEL_STRIPE: optionalTrimmedString,
  PAYMENT_SUBLABEL_SEPAY: optionalTrimmedString,
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/**
 * If value looks like a file path and file exists, read file content as actual value;
 * otherwise return value as-is.
 */
function resolveKeyValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  // Key content won't start with / or drive letter, only file paths will
  if ((value.startsWith('/') || /^[A-Za-z]:[/\\]/.test(value)) && fs.existsSync(value)) {
    try {
      return fs.readFileSync(value, 'utf-8').trim();
    } catch (err) {
      throw new Error(`Failed to read key file ${value}: ${(err as Error).message}`);
    }
  }
  return value;
}

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  // Build phase: don't validate environment variables (next build collects page data)
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return {} as Env;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }

  const env = parsed.data;

  // Alipay keys: supports key content directly or file path
  env.ALIPAY_PRIVATE_KEY = resolveKeyValue(env.ALIPAY_PRIVATE_KEY);
  env.ALIPAY_PUBLIC_KEY = resolveKeyValue(env.ALIPAY_PUBLIC_KEY);

  // WeChat Pay keys: supports key content directly or file path
  env.WXPAY_PRIVATE_KEY = resolveKeyValue(env.WXPAY_PRIVATE_KEY);
  env.WXPAY_PUBLIC_KEY = resolveKeyValue(env.WXPAY_PUBLIC_KEY);

  cachedEnv = env;
  return cachedEnv;
}
