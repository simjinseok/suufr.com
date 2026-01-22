import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from './_providers';

export const metadata: Metadata = {
  title: '스프',
  description: '과외 일정 관리 서비스',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: LayoutProps<'/'>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
