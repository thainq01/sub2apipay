import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PRODUCT_NAME } from '@/lib/constants';
import StoreHydrator from '@/components/StoreHydrator';
import './globals.css';

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} Recharge`,
  description: `${PRODUCT_NAME} balance recharge platform`,
};

// Theme script that runs before paint - checks URL param first (for iframe), then localStorage
// For embedded dark mode, use #0D1427 (matches sub2api dashboard) instead of transparent to avoid flicker
const THEME_SCRIPT = `(function(){try{var u=new URLSearchParams(location.search);var t=u.get('theme');if(!t){t=localStorage.getItem('theme')}if(!t)t=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;if(u.get('ui_mode')==='embedded'||window.self!==window.top){document.body.classList.add('embedded-iframe');document.body.style.background=t==='dark'?'#0D1427':'transparent'}}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: `body.embedded-iframe,body.embedded-iframe .pay-layout{background:transparent!important}[data-theme='dark'] body.embedded-iframe,[data-theme='dark'] body.embedded-iframe .pay-layout{background:#0D1427!important}` }} />
      </head>
      <body className="antialiased">
        <Suspense fallback={<div className="pay-layout h-screen w-full" />}>
          <StoreHydrator>{children}</StoreHydrator>
        </Suspense>
      </body>
    </html>
  );
}
