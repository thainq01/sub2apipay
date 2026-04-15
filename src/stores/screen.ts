import { create } from 'zustand';

export type ScreenType = 'home' | 'pay' | 'orders' | 'subscriptions';

// Pay screen step states
export type PayStep = 'form' | 'paying' | 'result';

// Subscriptions screen step states
export type SubscriptionStep = 'selecting' | 'paying' | 'success';

interface ScreenStore {
  screen: ScreenType;
  setScreen: (screen: ScreenType) => void;

  // Pay screen nested state
  payStep: PayStep;
  setPayStep: (step: PayStep) => void;

  // Subscriptions screen nested state
  subscriptionStep: SubscriptionStep;
  setSubscriptionStep: (step: SubscriptionStep) => void;

  // Orders screen state
  ordersFilter: string;
  setOrdersFilter: (filter: string) => void;
  ordersPage: number;
  setOrdersPage: (page: number) => void;

  // Reset nested states when changing screens
  resetScreenState: () => void;
}

export const useScreenStore = create<ScreenStore>((set) => ({
  screen: 'home',
  setScreen: (screen) => set({ screen }),

  payStep: 'form',
  setPayStep: (payStep) => set({ payStep }),

  subscriptionStep: 'selecting',
  setSubscriptionStep: (subscriptionStep) => set({ subscriptionStep }),

  ordersFilter: 'ALL',
  setOrdersFilter: (ordersFilter) => set({ ordersFilter }),
  ordersPage: 1,
  setOrdersPage: (ordersPage) => set({ ordersPage }),

  resetScreenState: () =>
    set({
      payStep: 'form',
      subscriptionStep: 'selecting',
      ordersFilter: 'ALL',
      ordersPage: 1,
    }),
}));

/**
 * Initialize screen from URL parameter
 */
export function hydrateScreen(screenParam: string | null | undefined): ScreenType {
  const validScreens: ScreenType[] = ['home', 'pay', 'orders', 'subscriptions'];
  if (screenParam && validScreens.includes(screenParam as ScreenType)) {
    const screen = screenParam as ScreenType;
    useScreenStore.setState({ screen });
    return screen;
  }
  useScreenStore.setState({ screen: 'home' });
  return 'home';
}
