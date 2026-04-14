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
const THEME_SCRIPT = `(function(){try{var u=new URLSearchParams(location.search);var t=u.get('theme');if(!t){t=localStorage.getItem('theme')}if(!t)t=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;if(u.get('ui_mode')==='embedded'||window.self!==window.top){document.body.style.background='transparent'}}catch(e){}})()`;

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
