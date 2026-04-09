import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { PRODUCT_NAME } from '@/lib/constants';
import './globals.css';

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} Recharge`,
  description: `${PRODUCT_NAME} balance recharge platform`,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const pathname = headerStore.get('x-pathname') || '';
  const search = headerStore.get('x-search') || '';
  const locale = new URLSearchParams(search).get('lang')?.trim().toLowerCase() === 'en' ? 'en' : 'zh';
  const htmlLang = locale === 'en' ? 'en' : 'zh-CN';

  return (
    <html lang={htmlLang} data-pathname={pathname}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
