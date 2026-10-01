import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT,
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profileSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // Sentry 11은 dataCollection을 지정하지 않으면 요청/응답 본문·사용자 IP 등까지 수집한다
  // (로그인 요청의 비밀번호가 그대로 전송됨). v10 기본값 수준으로 명시적으로 제한한다.
  // 쿠키·인증 헤더는 SDK 내장 필터(auth, token, cookie 등)가 항상 [Filtered] 처리한다.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: {
      request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
      response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
    },
    httpBodies: [],
    urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    graphQL: { document: false, variables: false },
  },
});
