'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ScreenRouter from '@/components/ScreenRouter';
import StoreHydrator from '@/components/StoreHydrator';

function AppFallback() {
  const searchParams = useSearchParams();
  const isDark = searchParams.get('theme') === 'dark';

  return (
    <div
      suppressHydrationWarning
      className={`flex min-h-screen items-center justify-center ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}
    >
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>
  );
}

function AppContent() {
  return (
    <StoreHydrator>
      <ScreenRouter />
    </StoreHydrator>
  );
}

export default function AppPage() {
  return (
    <Suspense fallback={<AppFallback />}>
      <AppContent />
    </Suspense>
  );
}
