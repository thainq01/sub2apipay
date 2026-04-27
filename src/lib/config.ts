import { z } from 'zod';

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}, z.string().optional());

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),

  SUB2API_BASE_URL: z.string().url(),
  SUB2API_ADMIN_API_KEY: z.string().min(1),

  // Payment service providers (comma-separated, e.g.: sepay)
  PAYMENT_PROVIDERS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),

  // SePay (required when PAYMENT_PROVIDERS contains sepay)
  SEPAY_API_KEY: optionalTrimmedString,
  SEPAY_BANK_ACCOUNT: optionalTrimmedString,
  SEPAY_BANK_NAME: optionalTrimmedString,
  SEPAY_ACCOUNT_NAME: optionalTrimmedString,
  SEPAY_ORDER_TIMEOUT_MINUTES: z.string().default('30').transform(Number).pipe(z.number().int().positive()).optional(),
  // VND per 1 credit on Sub2API (e.g., 2000 means 2000 VND = 1 credit)
  SEPAY_VND_PER_CREDIT: z.string().default('2000').transform(Number).pipe(z.number().positive()).optional(),
  // Coffee conversion rate (VND per 1 Coffee). Falls back to SEPAY_VND_PER_CREDIT if not set.
  RATE: z.string().optional().transform((v) => (v ? Number(v) : undefined)).pipe(z.number().positive().optional()),

  // Enable specific payment types (comma-separated)
  ENABLED_PAYMENT_TYPES: optionalTrimmedString,

  ORDER_TIMEOUT_MINUTES: z.string().default('5').transform(Number).pipe(z.number().int().positive()),
  MIN_RECHARGE_AMOUNT: z.string().default('1').transform(Number).pipe(z.number().positive()),
  MAX_RECHARGE_AMOUNT: z.string().default('1000').transform(Number).pipe(z.number().positive()),
  // Daily cumulative max recharge per user, 0 = unlimited
  MAX_DAILY_RECHARGE_AMOUNT: z.string().default('10000').transform(Number).pipe(z.number().min(0)),

  // Daily global limit per channel (0 = unlimited)
  MAX_DAILY_AMOUNT_SEPAY: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? Number(v) : undefined))
    .pipe(z.number().min(0).optional()),

  ADMIN_TOKEN: z.string().min(16),

  NEXT_PUBLIC_APP_URL: z.string().url(),
  PAY_HELP_IMAGE_URL: optionalTrimmedString,
  PAY_HELP_TEXT: optionalTrimmedString,

  // Allowed iframe origins (comma-separated)
  IFRAME_ALLOW_ORIGINS: optionalTrimmedString,

  PRODUCT_NAME: optionalTrimmedString,

  // Payment method frontend description (sublabel) override
  PAYMENT_SUBLABEL_SEPAY: optionalTrimmedString,

  // BSC USDT (blockchain payment)
  BSC_WALLET_ADDRESS: optionalTrimmedString,
  BSC_RPC_URL: z.string().default('https://bsc-dataseed.binance.org'),
  BSC_USDT_CONTRACT: z.string().default('0x55d398326f99059fF775485246999027B3197955'),
  BSC_REQUIRED_CONFIRMATIONS: z.string().default('15').transform(Number).pipe(z.number().int().positive()),
  BSC_SCAN_INTERVAL_MS: z.string().default('15000').transform(Number).pipe(z.number().int().positive()),
  // USDT per 1 coffee (e.g., 0.1 means 1 coffee = 0.1 USDT)
  RATE_USDT: z.string().optional().transform((v) => (v ? Number(v) : undefined)).pipe(z.number().positive().optional()),
  MIN_RECHARGE_AMOUNT_USDT: z.string().optional().transform((v) => (v ? Number(v) : undefined)).pipe(z.number().positive().optional()),
  MAX_RECHARGE_AMOUNT_USDT: z.string().optional().transform((v) => (v ? Number(v) : undefined)).pipe(z.number().positive().optional()),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

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

  cachedEnv = parsed.data;
  return cachedEnv;
}
