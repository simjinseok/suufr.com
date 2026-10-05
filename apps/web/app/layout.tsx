import type { Metadata, Viewport } from 'next';

import './globals.css';

import { GoogleAnalytics } from '@next/third-parties/google';
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
  // 런타임 환경변수 (빌드 타임 인라인 아님). 미설정이면 GA를 로드하지 않는다 — 개발/스테이징에서 프로덕션 속성으로 전송 방지
  const gaMeasurementId = process.env.GA_MEASUREMENT_ID;

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
      {gaMeasurementId && <GoogleAnalytics gaId={gaMeasurementId} />}
    </html>
  );
}
