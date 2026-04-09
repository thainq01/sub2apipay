import type { PaymentProvider, PaymentType, MethodDefaultLimits } from './types';

export class PaymentProviderRegistry {
  private providers = new Map<PaymentType, PaymentProvider>();
  private _ensureInitialized: (() => void) | null = null;

  /** Set lazy init callback, injected by initPaymentProviders */
  setInitializer(fn: () => void): void {
    this._ensureInitialized = fn;
  }

  private autoInit(): void {
    if (this._ensureInitialized) {
      this._ensureInitialized();
    }
  }

  register(provider: PaymentProvider): void {
    for (const type of provider.supportedTypes) {
      this.providers.set(type, provider);
    }
  }

  getProvider(type: PaymentType): PaymentProvider {
    this.autoInit();
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`No payment provider registered for type: ${type}`);
    }
    return provider;
  }

  hasProvider(type: PaymentType): boolean {
    this.autoInit();
    return this.providers.has(type);
  }

  getSupportedTypes(): PaymentType[] {
    this.autoInit();
    return Array.from(this.providers.keys());
  }

  /** Get default limit for specified channel (returns undefined if not registered) */
  getDefaultLimit(type: string): MethodDefaultLimits | undefined {
    this.autoInit();
    const provider = this.providers.get(type as PaymentType);
    return provider?.defaultLimits?.[type];
  }

  /** Get provider key for specified channel (e.g., 'easypay', 'stripe') */
  getProviderKey(type: string): string | undefined {
    this.autoInit();
    const provider = this.providers.get(type as PaymentType);
    return provider?.providerKey;
  }
}

export const paymentRegistry = new PaymentProviderRegistry();
