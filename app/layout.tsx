import type { Metadata } from 'next';
import './globals.css';

import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';

import { Providers } from './providers';
import Layout from '@/components/layout';

export const metadata: Metadata = {
  title: '스프',
  description: '과외 일정 관리 서비스',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" style={{ height: '100%' }}>
      <body style={{ height: '100%' }}>
        <Providers>
          <Layout>{children}</Layout>
          <Analytics />
          <SpeedInsights />
        </Providers>
      </body>

    </html>
  );
}
