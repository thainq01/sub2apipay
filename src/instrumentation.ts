export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startTimeoutScheduler } = await import('@/lib/order/timeout');
    startTimeoutScheduler();

    if (process.env.BSC_WALLET_ADDRESS) {
      const { startBscScanner } = await import('@/lib/providers/bsc-usdt');
      startBscScanner();
    }
  }
}
