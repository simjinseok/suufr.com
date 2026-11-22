import * as Sentry from '@sentry/nextjs';
import { sentryDataCollection } from './sentry.data-collection';
import { scrubEvent, scrubSpan } from './sentry.scrub';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  environment: process.env.SENTRY_ENVIRONMENT,

  dataCollection: sentryDataCollection,

  // 서버 액션 폼 값·반환값과 공유 링크 shareId 를 보내기 전에 지운다
  beforeSend: scrubEvent,
  beforeSendSpan: scrubSpan,
});
