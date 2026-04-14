'use client';

import { useLayoutEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { hydrateTheme } from '@/stores/theme';
import { hydrateLocale } from '@/stores/locale';

let globalHydrated = false;

export default function StoreHydrator({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const [hydrated, setHydrated] = useState(globalHydrated);

  useLayoutEffect(() => {
    if (!globalHydrated) {
      hydrateTheme(searchParams.get('theme'));
      hydrateLocale(searchParams.get('lang'));
      globalHydrated = true;
    }
    setHydrated(true);
  }, [searchParams]);

  // Always render children - the inline <script> already set data-theme on <html>,
  // so CSS will show correct colors. Returning null causes a blank flash.
  // The brief moment before hydration completes is acceptable since colors match.
  return <>{children}</>;
}
