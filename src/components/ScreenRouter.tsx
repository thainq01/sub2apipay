'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useThemeStore, hydrateTheme } from '@/stores/theme';
import { useLocaleStore, hydrateLocale } from '@/stores/locale';
import { useIframeContext } from '@/hooks/useIframeContext';
import { extractNavParams, type ScreenNavParams } from '@/lib/screen-nav';
import { hydrateScreen, type ScreenType } from '@/stores/screen';
import { HomeScreen, PayScreen, OrdersScreen, SubscriptionsScreen } from '@/screens';

export default function ScreenRouter() {
  const searchParams = useSearchParams();
  const { isIframe } = useIframeContext();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  // Extract initial params from URL
  const [navParams, setNavParams] = useState<ScreenNavParams>(() => {
    if (typeof window !== 'undefined') {
      return extractNavParams(new URLSearchParams(window.location.search));
    }
    return { screen: 'home' };
  });

  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');

  // Hydrate stores on mount
  useEffect(() => {
    const params = extractNavParams(searchParams);
    setNavParams(params);

    // Hydrate theme and locale from URL params
    hydrateTheme(params.theme);
    hydrateLocale(params.lang);
    const screen = hydrateScreen(params.screen);
    setCurrentScreen(screen);
  }, [searchParams]);

  // Listen for client-side navigation events
  const handleScreenNavigate = useCallback((event: CustomEvent<ScreenNavParams>) => {
    const params = event.detail;
    setNavParams(params);
    setCurrentScreen(params.screen);
  }, []);

  // Listen for browser back/forward
  const handlePopState = useCallback(() => {
    const params = extractNavParams(new URLSearchParams(window.location.search));
    setNavParams(params);
    setCurrentScreen(params.screen);
  }, []);

  useEffect(() => {
    window.addEventListener('screen-navigate', handleScreenNavigate as EventListener);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('screen-navigate', handleScreenNavigate as EventListener);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [handleScreenNavigate, handlePopState]);

  const token = navParams.token || '';

  // Render appropriate screen
  switch (currentScreen) {
    case 'pay':
      return <PayScreen token={token} isIframe={isIframe} navParams={navParams} />;
    case 'orders':
      return <OrdersScreen token={token} isIframe={isIframe} navParams={navParams} />;
    case 'subscriptions':
      return <SubscriptionsScreen token={token} isIframe={isIframe} navParams={navParams} />;
    case 'home':
    default:
      return <HomeScreen token={token} isIframe={isIframe} navParams={navParams} />;
  }
}
