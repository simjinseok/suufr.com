import * as Sentry from '@sentry/nextjs';
import { sentryDataCollection } from './sentry.data-collection';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  dataCollection: sentryDataCollection,

  replaysOnErrorSampleRate: 1.0,

  // 오류가 발생한 세션만 리플레이를 수집한다 (개인정보처리방침 "오류 발생 시" 고지와 일치).
  // 상시 샘플링은 오류 분석 목적을 넘어서는 수집이라 0으로 둔다.
  replaysSessionSampleRate: 0,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
