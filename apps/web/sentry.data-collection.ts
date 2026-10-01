import type * as Sentry from '@sentry/nextjs';

type DataCollection = NonNullable<NonNullable<Parameters<typeof Sentry.init>[0]>['dataCollection']>;

// Sentry 11은 dataCollection을 지정하지 않으면 요청/응답 본문·사용자 IP 등까지 수집한다
// (로그인 폼의 비밀번호가 그대로 전송됨). v10 기본값 수준으로 명시적으로 제한한다.
// 쿠키·인증 헤더는 SDK 내장 필터(auth, token, cookie 등)가 항상 [Filtered] 처리한다.
const DENY = ['forwarded', '-ip', 'remote-', 'via', '-user'];

export const sentryDataCollection: DataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { deny: DENY }, response: { deny: DENY } },
  httpBodies: [],
  // OAuth 콜백(/auth/google/callback)의 code·state 포함
  urlQueryParams: { deny: [...DENY, 'code', 'state'] },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  graphQL: { document: false, variables: false },
};
