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

  // On first mount, don't render children until stores are hydrated.
  // The inline <script> already set data-theme on <html>, so the background is correct.
  // This prevents any text/component flicker from wrong locale or theme.
  if (!hydrated) return null;

  return <>{children}</>;
}
