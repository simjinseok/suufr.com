import type { Metadata } from 'next';
import './globals.css';

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
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body style={{ height: '100%' }}>
        {children}
      </body>
    </html>
  );
}
