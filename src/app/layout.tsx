import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PRODUCT_NAME } from '@/lib/constants';
import StoreHydrator from '@/components/StoreHydrator';
import './globals.css';

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} Recharge`,
  description: `${PRODUCT_NAME} balance recharge platform`,
};

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(!t)t=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="antialiased">
        <Suspense fallback={<div className="pay-layout h-screen w-full" />}>
          <StoreHydrator>{children}</StoreHydrator>
        </Suspense>
      </body>
    </html>
  );
}
