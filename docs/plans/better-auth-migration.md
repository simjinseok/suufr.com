# AWS Cognito → better-auth 이전 계획서

작성일: 2026-10-04 / 검증·개정: 2026-10-05 (main a63d734 기준)
상태: 초안 (코드 변경 없음, 계획만)
대상: suufr.com 모노레포 (`apps/web` Next.js 16.3.7 / `apps/api` NestJS 12 + Fastify 5 + Prisma 7.10.0)

> 이 문서는 코드와 better-auth 공식 문서를 직접 읽고 작성했다. 문서 사이트(better-auth.com)는 네트워크 정책으로 접근이 막혀, GitHub 저장소 `better-auth/better-auth`의 `docs/content/docs/**/*.mdx` 원본과 npm 레지스트리 메타데이터(`better-auth@1.7.7` 타르볼의 `package.json`, `dist/` 구조)로 대신 검증했다.

---

## 0. 요약

| 결정 항목 | 선택 | 한 줄 이유 |
|---|---|---|
| better-auth 인스턴스 위치 | **`apps/api`(NestJS)** 에 둔다. web은 better-auth 패키지를 설치하지 않는다. | Prisma 어댑터가 Prisma Client를 요구하므로 web에 두면 "web은 Prisma를 쓰지 않는다" 규칙이 깨진다. Organization 부트스트랩·Cognito lazy migration 로직도 api에 있다. |
| web ↔ api 계약 | **기존 `/api/auth/*` NestJS 엔드포인트와 응답 형태를 유지**하고, 내부 구현만 `auth.api.*` 서버 호출로 교체한다. | `apps/web/actions/auth.ts`, `utils/api/auth.ts`, 로그인 폼이 거의 그대로 남는다. 한국어 에러 메시지도 api 한 곳에서 매핑한다. |
| 토큰 방식 | **JWT 플러그인 + Bearer 플러그인.** `access_token` 쿠키 = better-auth JWT(1시간), `refresh_token` 쿠키 = better-auth 세션 토큰(30일). api 가드는 `jose`로 JWKS 로컬 검증. | 지금의 access/refresh 2단 구조와 `proxy.ts` 갱신 흐름이 1:1로 대응된다. 가드는 요청마다 DB를 치지 않고, `request.user = { userId: sub, ... }` 주입 형태가 유지되어 `@CurrentUser()` 사용처(컨트롤러 17곳)는 무변경이다. |
| 사용자 ID | better-auth `users.id`(uuid) = **기존 Cognito sub**. 신규 가입자는 `crypto.randomUUID()`. | `advanced.database.generateId`를 함수로 지정하고, 기존 사용자 행은 백필/lazy migration 시 id를 직접 넣어 생성한다. FK 재작성 없음. |
| 비밀번호 이전 | **Lazy migration.** 첫 로그인 시 Cognito로 검증 성공하면 better-auth `accounts`(providerId=`credential`)에 해시를 기록. 30일 뒤 미이전자는 재설정 메일. | 사용자에게 재가입·재설정을 강요하지 않는다. 전원 재설정 메일 방식은 이탈 위험이 크고 메일 미도달 사용자를 잠근다. |
| 이메일 발송 | **AWS SES v2** (`@aws-sdk/client-sesv2`). 템플릿은 api 코드 내 한국어 함수. | 이미 AWS(S3/CloudFront, 서울 리전) 계정과 자격증명 관리 체계가 있다. Resend는 새 벤더·DKIM 설정·과금이 추가된다. |
| 인증코드 UX | **emailOTP 플러그인(6자리, 5분)** 으로 이메일 인증·비밀번호 재설정 모두 처리. 링크 방식 미사용. | 현재 web의 `verify-email`, `reset-password` 페이지가 6자리 코드 입력 UI다. 그대로 유지한다. |
| MFA | **twoFactor 플러그인(TOTP + 백업코드)**. 기존 Cognito MFA 사용자는 재등록 필수(시드 export 불가). | 재등록 전까지 `requiresTwoFactorSetup` 플래그로 설정 페이지로 강제 유도한다. |
| 세션 테이블 이름 충돌 | better-auth `session` 모델을 **`AuthSession` / `@@map("auth_sessions")`** 로 지정. | 기존 수업 모델 `Session`(`sessions` 테이블)과 Prisma 모델명·테이블명 모두 충돌하기 때문. `session.modelName: "authSession"`. |
| Google 로그인 | **Phase 7**에서 `socialProviders.google` + `oneTimeToken` 플러그인으로 추가. 캘린더 연동용 Google OAuth(`external_service_tokens`)와는 **별도 OAuth 클라이언트·별도 저장**. | 콜백은 api 도메인에 떨어지고 web은 자체 쿠키(JWT/세션 토큰)를 쓰므로, 일회용 토큰으로 api→web에 세션을 넘긴다. 같은 이메일의 기존 사용자(Cognito sub)에 자동 연결되어 ID가 보존된다. |

---

## 1. 과제 설명과 실제 코드가 다른 점 (코드 기준으로 작성)

조사 중 아래 항목이 과제의 "현재 구조" 설명과 달랐다. 이 계획서는 코드를 기준으로 한다.

1. **엔드포인트 접두사는 `/auth/*`가 아니라 `/api/auth/*`** 다. `apps/api/src/auth/auth.controller.ts`의 `@Controller('api/auth')`. 따라서 better-auth의 기본 `basePath`(`/api/auth`)와 **정확히 충돌**한다. better-auth 핸들러를 HTTP로 마운트하려면 `basePath`를 바꿔야 한다(§3.2).
2. **`@CurrentUser()` 사용 파일 18개**는 데코레이터 정의 파일(`common/decorators/current-user.decorator.ts`) 1개 + 컨트롤러 17개다. 실제 교체 대상 호출처는 컨트롤러 17곳이며, 가드가 `request.user`를 같은 모양으로 넣어주면 **0곳 수정**이다.
3. **`cognito_username` 쿠키에는 username이 아니라 Cognito sub가 들어간다.** `cognito.service.ts` `issueTokens`가 `cognitoUsername: userId`(= `payload.sub`)를 돌려준다. 가드가 넣는 `username`은 `cognito:username` 클레임이고, `/api/auth/me`는 이 값을 `user.name`으로 내려준다(표시용 이름이 아니다). better-auth 전환 후 `name`은 실제 가입 시 입력한 이름이 된다(개선 효과).
4. **refresh는 `proxy.ts` 한 곳이 아니다.** `apps/web/app/(auth)/layout.tsx`도 `refresh_token` + `cognito_username`으로 갱신을 시도한다. 둘 다 바꿔야 한다.
5. **`access_token` 쿠키를 직접 읽는 파일이 더 있다.** `apps/web/app/api/storage/files/route.ts`, `apps/web/app/api/storage/files/[uuid]/route.ts`, `apps/web/app/api/storage/presigned-url/route.ts`, `apps/web/app/auth/cloudfront/cookies/route.ts`, `apps/web/utils/auth.ts`. 쿠키 이름을 유지하면 수정이 필요 없다(§3.3).
6. **`.env.example`에 Cognito 변수가 없다.** `apps/api/.env.example`에는 S3/CloudFront/Paddle만 있고 `COGNITO_*`, `WEB_URL`, `POSTGRES_PRISMA_URL`이 빠져 있다. web `.env.example`에는 CDN/GA/Paddle만 있고 Cognito/OAuth 항목이 없다. CLAUDE.md 설명과 다르다. (Phase 2에서 `.env.example`을 현행화한다.)
7. **web에는 MFA "등록" UI가 없다.** 로그인 폼(`login-form.tsx`)이 Cognito `SOFTWARE_TOKEN_MFA` 챌린지 응답만 처리한다. 등록은 Cognito 콘솔/외부에서 한 것으로 보인다. 기존 MFA 사용자 수 파악이 필요하다(§8 열린 질문).
8. **api에 `@nestjs/jwt`가 설치되어 있지만 사용처가 없다.** 이번 작업에 쓰지 않으며, Phase 6 정리 때 함께 제거 후보로 둔다.
9. **CalDAV/CardDAV의 AppToken 검증은 이메일을 전혀 확인하지 않는다.** `app-tokens.service.ts` `validateToken(email, token)`은 토큰 해시만 조회하고 Basic auth의 이메일을 그대로 세션에 넣는다. Cognito와 무관하므로 이번 이전에 영향이 없다. `users` 테이블이 생기면 이메일 대조를 추가할 수 있으나 범위 밖이다.
10. **api에도 테스트 스크립트가 있다.** main(#22)에서 `apps/api/vitest.config.ts`(`src/**/*.spec.ts`, Nest DI 컨테이너 없이 생성자 mock 주입 방식)와 `test`/`test:run` 스크립트가 추가됐다. web도 `schemas/auth.test.ts`, `constants/legal.test.ts`, `utils/consent.test.ts`가 있다. "api는 테스트 스크립트 없음"은 더 이상 사실이 아니며, 이 계획의 가드·훅 테스트는 같은 방식(생성자 mock)으로 작성한다.
11. **약관·개인정보 동의 이력 `UserConsent`(`user_consents`)가 추가됐다(#22).** `userId`는 Cognito sub이며 **가입 직후 `SignUp` 응답의 `UserSub`로 기록**된다(이메일 미인증 상태에서도 행 존재). `SignupDto.consents`가 필수이고 `/api/auth/me`가 `consents.required`를 내려 `(app)/layout.tsx`가 재동의 모달을 띄운다. better-auth 가입 흐름에서도 동일하게 `users.id`로 기록해야 하며(§5 Phase 4), 열거 방지(합성 사용자) 응답과의 상호작용을 처리해야 한다.
12. **Google 캘린더 OAuth 콜백은 두 경로**다. api `/api/google/callback`(`@Public`, 메모리 `stateStore`)와 web `app/auth/google/callback/route.ts`(apiClient로 `/api/google/exchange-code` 호출). 둘 다 로그인과 무관하며 `userId`만 사용하므로 id가 보존되면 영향 없다.

---

## 2. 검증한 better-auth 버전·문서 사실

| 항목 | 확인값 |
|---|---|
| `better-auth` 최신 | **1.7.7** (2026-09-30 배포). 1.7.x 라인은 1.7.3(09-06)부터. |
| `@better-auth/prisma-adapter` | **1.7.7** (peer: `prisma ^5\|\|^6\|\|^7`, `@prisma/client ^5\|\|^6\|\|^7`). 문서는 이 패키지를 설치하라고 안내하지만 import 경로는 여전히 `better-auth/adapters/prisma`(타르볼 `exports`에 존재, 내부적으로 `@better-auth/prisma-adapter` 의존). |
| `@better-auth/cli` | **1.4.21**. `npx auth@latest generate --adapter prisma --dialect postgresql --config <path> --output <path>` 로 DB 연결 없이 Prisma 스키마 생성 가능. 마이그레이션 적용은 미지원(Prisma CLI 사용). |
| `jose` | better-auth 1.7.7의 의존성(`^6.2.3`). api 가드에서 직접 쓸 경우 `jose@6.2.12`. |
| Next.js peer | `next ^14 \|\| ^15 \|\| ^16`. Next 16 "fully compatible", `middleware.ts → proxy.ts` 명명만 변경. (이 계획에서는 web에 better-auth를 설치하지 않으므로 호환성 영향이 더 작다.) |
| Prisma 7 | 어댑터 문서가 Prisma 7 + `@prisma/adapter-pg` 드라이버 어댑터 예시로 작성됨. 현재 api 구성(`prisma-client` 제너레이터, `@prisma/adapter-pg`)과 동일. |
| JWT 플러그인 | `jwks` 테이블 추가. `/token`(세션→JWT), `/jwks` 엔드포인트. 기본 알고리즘 **EdDSA/Ed25519**, 기본 만료 **15분**, `jwt.expirationTime`, `issuer`/`audience` 기본값은 `BASE_URL`. `definePayload`로 페이로드 축소 가능. `getSession` 응답 헤더 `set-auth-jwt`. 개인키는 기본 AES-256-GCM 암호화 저장(`BETTER_AUTH_SECRET` 필요). |
| Bearer 플러그인 | `Authorization: Bearer <session token>`을 세션 쿠키처럼 취급. 로그인 응답 헤더 `set-auth-token`에 세션 토큰. 서버에서는 `auth.api.getSession({ headers })`. |
| Two-factor 플러그인 | `user.twoFactorEnabled`(boolean) + `twoFactor` 테이블(`secret`, `backupCodes`, `verified`, `failedVerificationCount`, `lockedUntil`). 로그인 시 `twoFactorRedirect: true` 응답. 서버 흐름에서는 `returnHeaders: true`로 받은 쿠키를 다음 `auth.api.verifyTOTP` 호출에 전달해야 함. 계정 잠금 기본 10회/15분. |
| Email OTP 플러그인 | `sendVerificationOTP({ email, otp, type })`, `type ∈ sign-in \| email-verification \| forget-password`. `otpLength` 6, `expiresIn` 300초, `allowedAttempts` 3. `overrideDefaultEmailVerification: true`로 링크 대신 OTP. `/email-otp/verify-email`, `/email-otp/request-password-reset`, `/email-otp/reset-password`. |
| 세션 | 기본 `expiresIn` 7일, `updateAge` 1일(슬라이딩). `cookieCache`는 쿠키 기반이므로 이 설계(api가 Bearer만 받음)에서는 사용하지 않음. |
| ID 생성 | `advanced.database.generateId`: 함수 \| `false` \| `"serial"` \| `"uuid"`. 함수가 모델별로 `false`를 돌려주면 그 모델만 DB 생성에 맡김. `"uuid"`는 PostgreSQL에서 DB가 생성하도록 두는 경우가 있어 Prisma `@default` 필요 → 이 계획은 **함수(`crypto.randomUUID()`)** 를 쓴다. |
| 테이블/컬럼 이름 | `user.modelName`, `session.modelName`, `fields`로 변경. Prisma 어댑터는 Prisma Client 모델 API를 쓰므로 **Prisma `@map`/`@@map`은 better-auth에 투명**하다(필드 매핑 설정 불필요, 모델명만 지정). |
| 스키마 검증 | 1.7.x는 초기화 시 Prisma 생성 클라이언트 모델과 better-auth가 쓰는 테이블을 대조하고 불일치를 로그로 보고(`advanced.database.validateSchema`, 운영에서도 기본 on). 요청은 검증 완료를 기다린다. |
| 훅 | `hooks.before/after`는 `createAuthMiddleware` 1개씩. `ctx.path`로 분기. `ctx.context.password.hash/verify`, `ctx.context.internalAdapter`, `APIError` 사용 가능. `databaseHooks.user.create.before/after`. |
| 비밀번호 | 기본 scrypt. `emailAndPassword.password.hash/verify` 커스텀 가능. `auth.api.setPassword`는 서버 전용. `better-auth/crypto`에서 `hashPassword`, `verifyPassword` export. |
| 열거 방지 | `requireEmailVerification: true` 또는 `autoSignIn: false`면 중복 이메일 가입 시에도 200 반환(합성 사용자, 무작위 id). 플러그인이 user 필드를 추가하면 `customSyntheticUser` 필요(twoFactor의 `twoFactorEnabled` + 이 계획의 additionalFields 해당). |
| 이메일 정규화 | 패키지 코드 확인: `sign-up`, `sign-in`, `internalAdapter.findUserByEmail/createUser`가 모두 `email.toLowerCase()`를 적용한다. 백필 시 소문자로 저장해야 조회가 맞는다. |
| 훅 실행 순서 | 패키지 코드 확인(`api/dispatch.mjs`): `options.hooks.before`가 플러그인 before 훅보다 **먼저** 실행된다. lazy migration 훅이 2FA·bearer 훅보다 앞서 동작함을 보장. |
| Prisma 모델명 해석 | 어댑터 코드 확인: `getModelName`이 첫 글자를 소문자로 바꿔 `prisma[model]`로 접근. 기본 `session`은 **`prisma.session`(수업 Session)** 을 가리키므로 충돌이 실제로 발생한다. `modelName: 'authSession'` → `prisma.authSession`. |
| 로그인 응답 | `signInEmail`은 본문에 `{ redirect, token(세션 토큰), user }`를 돌려준다. bearer 플러그인의 `set-auth-token` 헤더를 파싱할 필요 없이 본문 `token`을 쓰면 된다. 점(`.`)이 없는 토큰은 bearer 훅이 서버 시크릿으로 서명해 쿠키로 변환(`requireSignature` 기본 false). |
| emailOTP와 가입 | 패키지 코드 확인: `overrideDefaultEmailVerification: true`이면 `sendVerificationOnSignUp`은 **무시**되고, 코어 `sign-up`이 `requireEmailVerification`에 따라 (덮어쓴) `sendVerificationEmail`로 OTP를 보낸다. 미인증 사용자의 로그인 시도마다 OTP가 재발송된다(코어 `sign-in` 339~351행). |
| 소셜 로그인 | 엔드포인트 확인: `/sign-in/social`(서버 `auth.api.signInSocial` → 리다이렉트 `url` 반환), `/callback/:id`, `/link-social`. 계정 연결(`oauth2/link-account.mjs`): 제공자가 `trustedProviders`에 있거나 제공자 이메일이 검증됐고, **기존 DB 사용자의 `emailVerified`가 true**(`requireLocalEmailVerified` 기본 true)일 때 같은 이메일의 기존 사용자에 암묵적으로 연결. 2FA 플러그인의 로그인 가로채기는 `/sign-in/email·username·phone-number`에만 적용되어 소셜 로그인은 2FA를 거치지 않는다. |
| oneTimeToken 플러그인 | `/one-time-token/generate`(세션 필요) → 토큰, `/one-time-token/verify` → 세션. 기본 만료 3분, `storeToken: 'hashed'` 옵션. 교차 도메인(api→web) 세션 전달용. |
| 2FA 쿠키 | `createAuthCookie('two_factor')`로 생성 → 이름은 `<cookiePrefix>.two_factor`, 운영(secure)에서는 `__Secure-` 접두사가 붙는다. 서버 흐름에서는 `returnHeaders`로 받은 `set-cookie` 값을 그대로 다음 호출 `cookie` 헤더에 넣는 방식이 안전하다. |
| JWT 기본값 | `sign.mjs` 확인: `expirationTime` 기본 `15m`, `iss`/`aud` 기본 `options.baseURL`. `/token`은 `sessionMiddleware`를 사용하므로 Bearer 세션 토큰이 필요하다. `/jwks` 첫 호출 시 키가 없으면 생성. |
| NestJS 통합 | 공식 문서는 커뮤니티 패키지 `@thallesp/nestjs-better-auth`를 안내(Fastify 지원 "beta", 자체 전역 가드 등록). **이 계획은 쓰지 않는다**(§3.2). |

---

## 3. 설계 결정 상세

### 3.1 배치 위치: api (대안 비교)

| | A. web Route Handler에 better-auth, api는 JWT만 검증 | **B. api(NestJS)에 better-auth, web은 프록시 (선택)** |
|---|---|---|
| Prisma | web에 Prisma Client·DB URL 필요 → 규칙 위반 | api에만 존재. 변경 없음 |
| 사용자 부트스트랩(Organization/UserSettings) | web→api 추가 호출 필요(트랜잭션 분리) | `databaseHooks.user.create.after`에서 같은 Prisma 트랜잭션 |
| Cognito lazy migration | web이 Cognito SDK도 가져야 함 | 기존 `CognitoService` 재사용 |
| web 변경량 | 로그인 액션 전부 재작성, 쿠키 체계 변경 | 액션은 거의 유지, 쿠키 2개 의미만 바뀜 |
| 소셜 로그인(추후) | Next Route Handler가 콜백 처리(간단) | api에 핸들러 마운트 + api→web 리다이렉트(약간 복잡, 가능) |

→ **B**. 핸들러 HTTP 마운트(`/api/better-auth/*`)는 지금은 선택 사항이지만, 추후 소셜 로그인 콜백을 위해 Phase 2에서 `@Public` 라우트로 미리 마운트해 둔다.

### 3.2 NestJS/Fastify 통합 방식

- 커뮤니티 패키지 `@thallesp/nestjs-better-auth`는 (1) Fastify 지원이 beta, (2) 자체 `AuthGuard`를 전역 등록해 기존 `JwtAuthGuard`/`@Public()`과 충돌, (3) `bodyParser: false`를 요구해 기존 `rawBody: true`(Paddle 웹훅) 구성과 간섭 가능. → **직접 통합**한다.
- `apps/api/src/auth/better-auth/better-auth.provider.ts`: `betterAuth({...})` 인스턴스를 Nest 프로바이더로 생성(PrismaService의 client 주입). 이름 충돌 방지를 위해 토큰 `BETTER_AUTH`.
- `apps/api/src/auth/better-auth/better-auth.controller.ts`: `@Public() @All('api/better-auth/*')` — Fastify 문서의 패턴대로 `fromNodeHeaders` + `new Request(url, { method, headers, body: JSON.stringify(request.body) })` → `auth.handler(req)` → 상태/헤더/본문 전달. `basePath: '/api/better-auth'`.
- web이 호출하는 공개 엔드포인트는 **기존 `AuthController`(`/api/auth/*`)** 를 그대로 둔 채 내부에서 `auth.api.signInEmail(...)`, `auth.api.signUpEmail(...)`, `auth.api.getToken(...)` 등을 호출한다. better-auth `APIError`는 `apps/api/src/auth/better-auth/better-auth-error.map.ts`에서 코드→한국어 메시지→Nest `HttpException`으로 변환한다(기존 `HttpExceptionFilter` 응답 형식 유지).
- CORS: 기존 `main.ts` 수동 CORS 미들웨어가 `Authorization` 헤더를 허용하므로 추가 변경 없음. `trustedOrigins: [WEB_URL]`.

### 3.3 토큰 방식 (대안 비교)

| | **① JWT 플러그인 + Bearer (선택)** | ② Bearer 세션 토큰만 (가드가 `auth.api.getSession`) |
|---|---|---|
| api 가드 | `jose.jwtVerify` + JWKS(프로세스 내 캐시, `kid` 미스 시 재조회). DB 접근 없음 | 요청마다 세션+유저 조회(DB 1회) |
| 쿠키 | `access_token`=JWT(1h), `refresh_token`=세션 토큰(30일). **쿠키 이름 유지** → `api-client.ts`, storage 라우트, cloudfront 라우트 무변경 | `access_token`=세션 토큰 1개. 갱신 개념 없음(슬라이딩) |
| 갱신 | `proxy.ts`/`(auth)/layout.tsx`가 `/api/auth/refresh` 호출 → api가 `auth.api.getToken({ headers: Bearer 세션토큰 })`로 새 JWT 발급 | 불필요 |
| 즉시 폐기 | JWT 만료(≤1h)까지 유효 — **현재 Cognito와 동일한 특성** | 즉시 |
| 변경량 | 가드 내부 교체, web 쿠키 세터 2곳 | 가드 교체 + web 쿠키/갱신 로직 삭제(더 많은 web 변경) |

→ **①**. JWT 설정: `jwt.expirationTime: '1h'`, `definePayload: ({ user }) => ({ email: user.email, name: user.name })`(sub는 기본이 user.id), `issuer`/`audience` = `BETTER_AUTH_URL`. 가드는 `sub`→`userId`, `email`, `name`→`username`으로 매핑해 `AuthenticatedUser` 타입을 유지한다(`username` 필드명은 유지, 값은 표시 이름). 세션: `expiresIn: 60*60*24*30`, `updateAge: 60*60*24`.

### 3.4 사용자 ID 보존

- `users.id String @id @db.Uuid`. 기존 사용자는 Phase 1 백필에서 `id = Cognito sub`로 삽입.
- `advanced.database.generateId: () => crypto.randomUUID()` — 신규 가입자·세션·계정·검증 행 모두 UUID v4. (`@db.Uuid` 컬럼이므로 기본 base62 ID는 불가.)
- Lazy migration은 Prisma로 `users`/`accounts` 행을 직접 만들므로 `generateId`를 거치지 않는다.
- 기존 테이블의 `userId` 컬럼에 **FK를 추가하지 않는다**(수억 건 재작성 금지 조건, 삭제된 Cognito 사용자 잔존 데이터 가능). 추후 별도 과제.

### 3.5 비밀번호 이전 전략 (대안 비교)

| | **A. Lazy migration (선택)** | B. 전원 비밀번호 재설정 메일 | C. Cognito 유지 + 신규만 better-auth |
|---|---|---|---|
| 사용자 체감 | 없음(로그인 1회로 자동 이전) | 전원 재설정 필수, 메일 미도달 시 잠김 | 없음 |
| 기간 | Cognito 병행 ≥30일 + 잔여자 처리 | 즉시 | 무기한 병행(목표 미달) |
| 복잡도 | 로그인 훅 1개 + 플래그 | 대량 메일 발송·고객지원 | 두 체계 영구 유지 |
| 보안 | 비밀번호가 평문으로 api 메모리를 통과하는 구간은 지금과 동일(이미 Cognito에 평문 전송 중) | 가장 깨끗 | — |

→ **A**, 그리고 30일(Cognito refresh token 수명) 경과 후 남은 미이전자에게만 **B를 적용**(재설정 안내 메일 1회, 이후 Cognito 폐기).

동작(`hooks.before`, `ctx.path === '/sign-in/email'`):
1. `users`에서 소문자 이메일로 조회. **행이 없어도 바로 실패시키지 않고** 3으로 진행한다(Phase 0 export 이후 Cognito에서 가입했지만 한 번도 로그인하지 않은 사용자는 `users` 행이 없다). Cognito 검증 성공 시 액세스 토큰 클레임(`sub`, `email`, `name`)으로 `users` 행을 먼저 만든다. Phase 4 배포 직전에 export·백필을 한 번 더 돌려 이 경우를 최소화한다.
2. 있고 `accounts(providerId='credential')`가 있으면 → 훅 종료, better-auth가 정상 검증.
3. 있고 credential 계정이 없으면(미이전) → `CognitoService.login(email, password)` 호출.
   - `AuthenticationResult` 또는 `SOFTWARE_TOKEN_MFA` 챌린지 응답(=비밀번호 맞음) → (`users` 행 없으면 생성 후) `ctx.context.password.hash(password)`로 해시 → `accounts` 행 생성(`accountId = user.id`, `providerId = 'credential'`), `users.cognitoMigratedAt = now()`, Cognito MFA 사용자였으면 `requiresTwoFactorSetup = true`. 훅 종료 → better-auth가 방금 넣은 해시로 검증·세션 발급.
   - `NEW_PASSWORD_REQUIRED` 챌린지 → 기존 `/api/auth/new-password` 레거시 경로로 안내(응답 `requiresNewPassword`)하고 이전은 다음 로그인으로 미룬다.
   - `NotAuthorized`/`UserNotFound`/`UserNotConfirmed` → 기존 한국어 메시지 그대로 반환.
4. 타이밍/열거: 미이전 사용자의 실패 응답도 better-auth 기본 실패 응답과 같은 메시지로 통일한다.

### 3.6 이메일 발송

- **SES v2** (`@aws-sdk/client-sesv2`, 3.1146.0). 모듈 `apps/api/src/mail/`(`mail.module.ts`, `mail.service.ts`, `templates/verify-email.ts`, `templates/reset-password.ts`, `templates/reenroll-mfa.ts`, `templates/migrate-notice.ts`).
- 환경변수(값 금지, 이름만): `AWS_SES_REGION`(미설정 시 `AWS_REGION`), `AWS_SES_ACCESS_KEY`, `AWS_SES_SECRET_KEY`(S3 키와 분리한 최소권한 IAM 권장), `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`, `MAIL_REPLY_TO`(선택). 로컬에서는 `MAIL_TRANSPORT=log`로 콘솔 출력.
- 템플릿은 한국어 HTML+텍스트, 코드 6자리·만료 5분 안내. 발송은 `void mailService.send(...)`로 await 하지 않는다(문서의 타이밍 공격 권고). 실패는 Sentry에 기록.
- 대안 Resend: API가 더 단순하지만 새 벤더·도메인 DKIM/SPF 재설정·요금이 추가되고, SES는 이미 서울 리전 계정에 있다. Cognito가 현재 SES 자격증명으로 발송 중인지 확인 필요(§8).

### 3.7 한국어 에러 메시지

- better-auth는 `APIError`에 `body.code`(예: `INVALID_EMAIL_OR_PASSWORD`, `USER_NOT_FOUND`, `EMAIL_NOT_VERIFIED`, `USER_ALREADY_EXISTS`, `INVALID_OTP`, `OTP_EXPIRED`, `TOO_MANY_ATTEMPTS`, `INVALID_TWO_FACTOR_CODE`, `PASSWORD_TOO_SHORT`, `PASSWORD_TOO_LONG`, `ACCOUNT_TEMPORARILY_LOCKED`)를 넣는다.
- `better-auth-error.map.ts`에서 코드→한국어 문구를 매핑하고, 매핑 없는 코드는 "요청을 처리할 수 없습니다" + Sentry. 기존 `CognitoService`의 문구를 그대로 승계해 web 변경 없음.
- web의 Zod 메시지(`apps/web/schemas/auth.ts`)는 그대로.

### 3.8 비밀번호 정책

Cognito는 대/소문자·숫자·특수문자를 요구했고 better-auth는 길이(8~128)만 검사한다. 기존 사용자 혼란을 줄이기 위해 **web Zod 스키마와 api DTO에 동일한 정규식 정책을 추가**해 Cognito 정책을 유지한다(완화 여부는 §8).

---

## 4. 데이터베이스 스키마 (apps/api/prisma/schema.prisma)

CLI `npx auth@latest generate --adapter prisma --dialect postgresql --config apps/api/src/auth/better-auth/auth.config.ts --output <scratch>.prisma`로 생성한 결과를 **참고용**으로만 쓰고, 아래처럼 기존 관례(snake_case `@@map`, `@db.Timestamptz(0)`)에 맞춰 수작업 반영한다. 모델명은 better-auth 설정과 일치해야 한다.

```prisma
// better-auth 사용자 (id = 기존 Cognito sub, 신규는 uuid v4)
model User {
  id                     String    @id @db.Uuid
  name                   String
  email                  String    @unique
  emailVerified          Boolean   @default(false) @map("email_verified")
  image                  String?
  twoFactorEnabled       Boolean?  @map("two_factor_enabled")          // twoFactor 플러그인
  cognitoMigratedAt      DateTime? @map("cognito_migrated_at") @db.Timestamptz(0) // lazy migration 완료 시각
  cognitoMfaEnabled      Boolean   @default(false) @map("cognito_mfa_enabled")   // export 시점 Cognito MFA 상태
  requiresTwoFactorSetup Boolean   @default(false) @map("requires_two_factor_setup")
  createdAt              DateTime  @default(now()) @map("created_at") @db.Timestamptz(0)
  updatedAt              DateTime  @updatedAt @map("updated_at") @db.Timestamptz(0)

  sessions   AuthSession[]
  accounts   Account[]
  twoFactors TwoFactor[]

  @@map("users")
}

// better-auth 세션. 기존 수업 Session(sessions)과 충돌하므로 이름을 바꾼다.
model AuthSession {
  id        String   @id @db.Uuid
  token     String   @unique
  userId    String   @map("user_id") @db.Uuid
  expiresAt DateTime @map("expires_at") @db.Timestamptz(0)
  ipAddress String?  @map("ip_address")
  userAgent String?  @map("user_agent")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(0)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(0)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("auth_sessions")
}

model Account {
  id                    String    @id @db.Uuid
  userId                String    @map("user_id") @db.Uuid
  accountId             String    @map("account_id")
  providerId            String    @map("provider_id")   // 'credential' | 추후 'google' 등
  accessToken           String?   @map("access_token")
  refreshToken          String?   @map("refresh_token")
  accessTokenExpiresAt  DateTime? @map("access_token_expires_at") @db.Timestamptz(0)
  refreshTokenExpiresAt DateTime? @map("refresh_token_expires_at") @db.Timestamptz(0)
  scope                 String?
  idToken               String?   @map("id_token")
  password              String?   // scrypt 해시
  createdAt             DateTime  @default(now()) @map("created_at") @db.Timestamptz(0)
  updatedAt             DateTime  @updatedAt @map("updated_at") @db.Timestamptz(0)
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([providerId, accountId])
  @@index([userId])
  @@map("accounts")
}

model Verification {
  id         String   @id @db.Uuid
  identifier String
  value      String
  expiresAt  DateTime @map("expires_at") @db.Timestamptz(0)
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(0)
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz(0)

  @@index([identifier])
  @@map("verifications")
}

model Jwks {
  id         String    @id @db.Uuid
  publicKey  String    @map("public_key")
  privateKey String    @map("private_key")   // BETTER_AUTH_SECRET으로 AES-256-GCM 암호화됨
  createdAt  DateTime  @default(now()) @map("created_at") @db.Timestamptz(0)
  expiresAt  DateTime? @map("expires_at") @db.Timestamptz(0)

  @@map("jwks")
}

model TwoFactor {
  id                      String    @id @db.Uuid
  userId                  String    @map("user_id") @db.Uuid
  secret                  String
  backupCodes             String    @map("backup_codes")
  verified                Boolean   @default(false)
  failedVerificationCount Int       @default(0) @map("failed_verification_count")
  lockedUntil             DateTime? @map("locked_until") @db.Timestamptz(0)
  user                    User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("two_factors")
}
```

better-auth 측 설정(모델명만 지정; 컬럼 매핑은 Prisma `@map`이 처리):

```ts
user:         { modelName: 'user',
                additionalFields: {
                  cognitoMigratedAt:      { type: 'date',    required: false, input: false },
                  cognitoMfaEnabled:      { type: 'boolean', required: false, input: false, defaultValue: false },
                  requiresTwoFactorSetup: { type: 'boolean', required: false, input: false, defaultValue: false },
                } },
session:      { modelName: 'authSession', expiresIn: 60*60*24*30, updateAge: 60*60*24 },
account:      { modelName: 'account' },
verification: { modelName: 'verification' },
emailAndPassword: { enabled: true, requireEmailVerification: true, autoSignIn: false,
                    customSyntheticUser: ({ coreFields, additionalFields, id }) => ({ ...coreFields, twoFactorEnabled: false, ...additionalFields, id }),
                    onExistingUserSignUp },
plugins: [ jwt({ jwt: { expirationTime: '1h', issuer: BETTER_AUTH_URL, audience: BETTER_AUTH_URL, definePayload } }), bearer(), twoFactor({ issuer: '스프' }),
           emailOTP({ otpLength: 6, expiresIn: 300, overrideDefaultEmailVerification: true, sendVerificationOTP }) ],  // sendVerificationOnSignUp은 override 시 무시됨 — 코어 sign-up이 OTP 발송
disabledPaths: ['/sign-in/email-otp'],   // OTP 단독 로그인은 미제공(의도치 않은 비밀번호 우회 방지)
advanced: { database: { generateId: () => crypto.randomUUID() } },
```

(`jwks`, `twoFactor` 테이블은 플러그인 기본 모델명 `jwks`/`twoFactor`를 그대로 쓰므로 별도 지정 불필요. `twoFactorTable` 옵션으로 바꿀 수 있다.)

---

## 5. 단계별 작업

모든 단계는 독립 배포 가능하고, 각 단계의 롤백은 "직전 배포로 되돌리기 + (필요시) 플래그 off"다. 마이그레이션은 모두 **additive**(테이블/컬럼 추가만)로 설계해 코드 롤백 시 DB를 되돌릴 필요가 없게 한다. Prisma 규칙: `schema.prisma` 편집 → `pnpm --filter api prisma:migrate -- --create-only --name <이름>` → SQL 검토 → `pnpm --filter api prisma:deploy`.

### Phase 0 — 사전 조사·준비 (배포 없음)

**작업**
- Cognito 유저풀 export 스크립트 작성: `apps/api/scripts/export-cognito-users.ts` — `ListUsersCommand`(페이지 60건) + `AdminGetUserCommand`(MFA 상태 `UserMFASettingList`/`PreferredMfaSetting`)로 `sub, email, name, email_verified, UserStatus, mfaEnabled`를 JSON으로 저장(저장 위치는 레포 밖, 커밋 금지).
- DB 대조: `organizations.user_id` DISTINCT ⊂ export sub 집합인지, 반대로 Organization 없는 Cognito 사용자(가입 후 미로그인) 수 파악.
- SES: 발신 도메인/주소 인증 상태, 샌드박스 해제 여부, Cognito가 현재 어떤 발신자를 쓰는지 확인.
- 기존 MFA 사용자 수, `UNCONFIRMED`(이메일 미인증) 사용자 수, `FORCE_CHANGE_PASSWORD`(임시 비밀번호) 사용자 수 집계.

**패키지/환경변수/마이그레이션**: 없음.
**검증**: export 건수 = 유저풀 "Users" 카운트. 중복 이메일(대소문자 차이) 없음 확인(better-auth `email @unique`).
**롤백**: 해당 없음. **사용자 변화**: 없음.

### Phase 1 — `users` 테이블 도입 및 Cognito sub 백필 (인증 로직 무변경)

**변경 파일**
- `apps/api/prisma/schema.prisma`: `User` 모델 추가(§4 중 `User`만, `twoFactorEnabled`/관계 제외 — 이후 Phase 2에서 추가).
- `apps/api/prisma/migrations/<ts>_add_auth_users/migration.sql` (생성 후 검토).
- `apps/api/scripts/backfill-users-from-cognito.ts`: Phase 0 export JSON → `users` upsert(`id=sub`, `email`(**소문자 정규화**, better-auth가 소문자로 조회), `name`(없으면 이메일 로컬파트), `emailVerified = (email_verified==='true' && UserStatus==='CONFIRMED')`, `cognitoMfaEnabled`). 멱등(재실행 안전).
- `apps/api/src/auth/cognito.service.ts` `ensureUserWithOrganization`: Organization 생성 직전에 `users` upsert 추가(`UserConsent`가 가입 시점에 sub로 먼저 기록되는 것과 같은 원리)(백필 이후 Cognito에서 신규 가입/첫 로그인하는 사용자도 행을 갖도록). **다른 로직 변경 없음.**

**패키지**: 없음. **환경변수**: 없음. **마이그레이션 이름**: `add_auth_users`.
**검증**
- `SELECT count(*) FROM users` = export 건수(±백필 이후 신규).
- `SELECT DISTINCT user_id FROM organizations WHERE deleted_at IS NULL EXCEPT SELECT id FROM users` → 0건(또는 삭제된 Cognito 사용자만).
- 로그인/가입/갱신 수동 체크리스트: 기존 그대로 동작.
**롤백**: 코드 롤백만. 테이블은 남겨도 무해(참조하는 코드 없음).
**사용자 변화**: 없음.

### Phase 2 — better-auth 설치·스키마·메일 모듈 (다크 런치)

**변경 파일**
- `apps/api/package.json`: 추가 `better-auth@1.7.7`, `@better-auth/prisma-adapter@1.7.7`, `jose@^6.2`, `@aws-sdk/client-sesv2@^3.1146`. devDependencies에 `@better-auth/cli@1.4.21`(스키마 생성 참고용).
- `apps/api/prisma/schema.prisma`: `User`에 `twoFactorEnabled`, `cognitoMigratedAt`, `requiresTwoFactorSetup`, 관계 추가; `AuthSession`, `Account`, `Verification`, `Jwks`, `TwoFactor` 추가(§4).
- `apps/api/prisma/migrations/<ts>_add_better_auth_tables/migration.sql`.
- 신규 `apps/api/src/auth/better-auth/auth.config.ts`(옵션 객체, CLI `--config`가 읽을 수 있게 순수 함수로), `better-auth.provider.ts`, `better-auth.controller.ts`(`@Public() @All('api/better-auth/*')` — NestJS 11+에서 와일드카드 표기가 바뀌었으므로(Express는 `*splat` 필수) Fastify 어댑터에서 `*`가 동작하는지 구현 시 확인, 안 되면 `{*path}`), `better-auth-error.map.ts`, `cognito-migration.hook.ts`(Phase 4에서 활성화, 지금은 미등록).
- 신규 `apps/api/src/mail/*`(§3.6).
- `apps/api/src/auth/auth.module.ts`: `MailModule` import, `BETTER_AUTH` 프로바이더 등록.
- `apps/api/src/auth/user-provisioning.service.ts`: `ensureUserWithOrganization` 이동(Cognito/better-auth 공용). `databaseHooks.user.create.after`에서 호출.
- `apps/api/.env.example`: Cognito 포함 현행화 + 신규 변수 추가.
- `apps/api/src/main.ts`: 변경 없음(기존 `rawBody: true`, 수동 CORS 유지). better-auth 라우트가 `/api/better-auth`로 분리되어 Nest 라우팅과 충돌하지 않음을 확인.

**환경변수(api)**: `BETTER_AUTH_SECRET`(32바이트 이상 랜덤), `BETTER_AUTH_URL`(api 공개 URL, JWT iss/aud), `WEB_URL`(기존, `trustedOrigins`), `AWS_SES_REGION`, `AWS_SES_ACCESS_KEY`, `AWS_SES_SECRET_KEY`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`, `MAIL_TRANSPORT`(`ses`|`log`).
**마이그레이션 이름**: `add_better_auth_tables`.
**검증**
- 앱 기동 시 better-auth 스키마 검증 로그에 불일치 없음(`advanced.database.validateSchema` 기본 on). `npx auth@latest check schema --config ...` 통과.
- `GET /api/better-auth/ok`(better-auth 기본 헬스 엔드포인트) 200, `GET /api/better-auth/jwks` 가 키 1개 반환(첫 호출에 `jwks` 행 생성).
- 스테이징에서 `auth.api.signUpEmail` → OTP 메일 수신 → `auth.api.verifyEmailOTP` → `users`/`accounts`/`organizations`/`user_settings` 행 생성 확인(스크립트 또는 임시 e2e).
- 기존 Cognito 로그인·갱신·CloudFront 쿠키·CalDAV 체크리스트 회귀 없음.
**롤백**: 코드 롤백. 테이블 잔존 무해.
**사용자 변화**: 없음(web 미사용).

### Phase 3 — api 가드 dual-accept (Cognito JWT ∪ better-auth JWT)

**변경 파일**
- `apps/api/src/auth/guards/jwt-auth.guard.ts`: 토큰 헤더/페이로드의 `iss`로 분기. `iss`가 Cognito 유저풀 issuer(`https://cognito-idp.<region>.amazonaws.com/<poolId>`)면 기존 `CognitoJwtVerifier`, `BETTER_AUTH_URL`이면 `jose.jwtVerify(token, jwks, { issuer, audience })`. JWKS는 `auth.api.getJwks()`(또는 `prisma.jwks`)로 프로세스 내 `createLocalJWKSet` 캐시, 알 수 없는 `kid`면 1회 재조회. `request.user = { userId: payload.sub, email: payload.email, username: payload.name }`.
- `apps/api/src/common/decorators/current-user.decorator.ts`: 변경 없음. 컨트롤러 17곳: 변경 없음.
- `AUTH_ACCEPT_COGNITO_TOKENS`(기본 `true`) 플래그 추가 — Phase 6에서 `false`.

**패키지**: 없음(Phase 2에서 `jose` 추가됨). **환경변수**: `AUTH_ACCEPT_COGNITO_TOKENS`. **마이그레이션**: 없음.
**검증**
- 단위 테스트 신설 `apps/api/src/auth/guards/jwt-auth.guard.spec.ts`(기존 api vitest 구성 사용, 생성자 mock 주입): Cognito 토큰 경로/better-auth 토큰 경로/`iss` 불일치/만료/`kid` 로테이션 각 케이스.
- 스테이징: Phase 2에서 만든 테스트 사용자로 `auth.api.getToken` JWT 발급 → `GET /api/auth/me`, `POST /api/auth/cloudfront/cookies`, `GET /api/students` 200. 기존 Cognito 토큰도 200.
**롤백**: 코드 롤백(가드만). **사용자 변화**: 없음.

### Phase 4 — 가입·로그인·갱신·재설정 dual-run + lazy migration (사용자 가시 변화 시작)

api 쪽: `AuthController`의 라우트와 응답 모양을 유지하면서 구현을 교체한다.

| 엔드포인트 | Phase 4 동작 |
|---|---|
| `POST /api/auth/signup` | **better-auth만**: `auth.api.signUpEmail({ name, email, password })`(`requireEmailVerification: true`, `autoSignIn: false`) → OTP 메일. 응답 `{ success, message }` 유지. **동의 이력**: 응답 `user.id`로 `ConsentsService.recordSafely` 호출. 단, 중복 이메일이면 better-auth가 무작위 id의 합성 사용자를 돌려주므로 `users`를 이메일로 조회해 `id`가 일치할 때만 기록한다(불일치 = 기존 사용자, 재동의 모달이 보완). `SignupDto.consents` 필수는 유지. 중복 이메일은 열거 방지로 200(기존 409와 다름 → 메시지 "인증 이메일이 발송되었습니다"로 통일; §8). |
| `POST /api/auth/verify-email`, `resend-verification` | better-auth 사용자면 `auth.api.verifyEmailOTP` / `sendVerificationOTP({ type: 'email-verification' })`. `users` 행이 없고 Cognito `UNCONFIRMED`인 잔여 사용자만 Cognito 경로(이메일로 분기). |
| `POST /api/auth/login` | lazy migration 훅(§3.5) 포함 `auth.api.signInEmail({ body, returnHeaders: true })`. 응답 **본문 `token`**(세션 토큰) → `auth.api.getToken({ headers: { authorization: 'Bearer ' + token } })`로 JWT 발급 → `{ success, accessToken: <JWT>, refreshToken: <세션토큰>, expiresIn: 3600, cognitoUsername: user.id }` (필드명 유지, `cognitoUsername` 값은 user.id로 유지되어 web 변경 최소). `twoFactorRedirect`면 응답 헤더의 `set-cookie`(two_factor 쿠키, 운영에서는 `__Secure-` 접두사) 값을 그대로 `{ success, requiresMfa: true, challengeName: 'TOTP', session: <set-cookie 문자열> }`로 반환(web은 기존처럼 `mfa_session` 쿠키에 5분 보관). Cognito 레거시 챌린지(`NEW_PASSWORD_REQUIRED`)는 기존 응답 유지. |
| `POST /api/auth/mfa` | `session` 값이 better-auth 2FA set-cookie 문자열이면(`two_factor=` 포함) 쿠키 이름=값 부분만 추출해 `auth.api.verifyTOTP({ body: { code }, headers: { cookie }, returnHeaders: true })` → 본문 `token`으로 JWT 발급; 아니면 기존 Cognito `respondToMfa`. 백업코드는 `auth.api.verifyBackupCode`. |
| `POST /api/auth/new-password` | Cognito 레거시 유지(이전은 다음 로그인에서). |
| `POST /api/auth/forgot-password`, `reset-password` | credential 계정 있으면 `auth.api.requestPasswordResetEmailOTP` / `resetPasswordEmailOTP({ email, otp, password })`. 미이전 사용자는 Cognito 경로 → 성공 시 **동시에 better-auth에도 해시 기록**(`accounts` 생성, 비밀번호를 이미 알고 있으므로)하여 즉시 이전. |
| `POST /api/auth/refresh` | body `{ refreshToken, username }` 유지. 판별: Cognito refresh token은 점(`.`)으로 구분된 JWE 문자열, better-auth 세션 토큰은 점이 없는 랜덤 문자열 → `refreshToken.includes('.')`이면 Cognito; 아니면 `auth.api.getToken({ headers: { authorization: 'Bearer ' + refreshToken } })` → `{ success, accessToken, expiresIn: 3600 }`. 세션 만료(`getSession` null)면 401 "세션이 만료되었습니다". |
| `POST /api/auth/logout` (신규) | `auth.api.signOut({ headers: Bearer 세션토큰 })` → `auth_sessions` 행 삭제. |
| `GET /api/auth/me` | 변경 없음(가드가 `request.user` 주입). `user.name`은 이제 표시 이름. 추가로 `requiresTwoFactorSetup`, `twoFactorEnabled` 노출. |

web 쪽 변경 파일
- `apps/web/actions/auth.ts`: `setTokenCookies`에서 `refresh_token` 쿠키에 `maxAge: 30일` 지정(현재 세션 쿠키 → 브라우저 종료 시 소실 문제도 해결), `cognito_username` 쿠키는 **더 이상 설정하지 않음**(레거시 Cognito 로그인 응답에서만 설정). `login` 액션의 MFA 분기는 그대로.
- `apps/web/proxy.ts`, `apps/web/app/(auth)/layout.tsx`: 갱신 조건을 `refreshToken && username` → `refreshToken`만으로 완화(`username`은 있으면 전달). 실패 시 로그인 리다이렉트 유지.
- `apps/web/app/auth/logout/route.ts`: 쿠키 삭제 전에 `authApi.logout()` 호출(서버 세션 폐기), 실패해도 쿠키는 삭제.
- `apps/web/utils/api/auth.ts`: `logout` 추가, 타입 필드 주석 갱신.
- `apps/web/utils/auth.ts` `Session.user`: `requiresTwoFactorSetup?`, `twoFactorEnabled?` 추가.
- `apps/web/app/(app)/layout.tsx`: 기존 `ReconsentModal`(동의 재확인) 옆에 `requiresTwoFactorSetup` 배너를 추가. 강제 리다이렉트(`/settings/security?reenroll=1`)는 Phase 5 UI 배포 후에 켠다.
- `apps/web/actions/auth.ts` `signup`: 이미 `consents: await buildConsentPayload()`를 보내므로 변경 없음(api가 better-auth 가입 뒤 기록).
- `apps/web/schemas/auth.ts`: 비밀번호 정책 정규식 추가(§3.8).

**패키지**: web 없음(better-auth 미설치). **환경변수**: `AUTH_SIGNUP_PROVIDER`(=`better-auth`, 긴급 시 `cognito`로 되돌리기), `AUTH_LAZY_MIGRATION`(기본 `true`).
**마이그레이션**: 없음(Phase 2 스키마 사용).
**검증(수동 체크리스트, 스테이징 → 운영 카나리)**
1. 신규 가입 → OTP 메일 → 인증 → 로그인 → 대시보드, `organizations`/`user_settings` 생성.
2. 기존 Cognito 사용자(미이전) 로그인 → `accounts` 행 생성, `cognito_migrated_at` 세팅, 대시보드 진입, 학생 목록 등 기존 데이터 그대로. `users` 행이 없던 사용자(export 이후 가입)도 동일하게 동작.
2-1. 신규 가입 → `user_consents`에 `users.id`로 3종 기록. 중복 이메일 가입 시도 → 200, `user_consents`에 무작위 id 행이 **생기지 않음**.
3. 같은 사용자 두 번째 로그인 → Cognito 호출 없음(로그/Sentry breadcrumb로 확인).
4. 잘못된 비밀번호(이전/미이전 모두) → 동일 메시지, 429 동작.
5. 로그인 상태에서 1시간 경과(또는 `access_token` 쿠키 삭제) → `proxy.ts` 갱신 성공, 리다이렉트 없음.
6. 기존 로그인 중인 사용자(Cognito 쿠키 보유): 갱신 계속 동작(Phase 3 가드 + Cognito refresh 경로).
7. 비밀번호 찾기: 이전/미이전 각각 OTP 수신·재설정·재로그인.
8. 로그아웃 → `auth_sessions` 삭제, 이전 `refresh_token`으로 갱신 401.
9. Cognito MFA 사용자 로그인 → 이전 완료 + `requiresTwoFactorSetup=true` + 안내 표시.
10. CloudFront 쿠키 발급, 파일 업로드(storage 라우트), CalDAV 동기화, Google 연동 상태 조회 정상.
**롤백**: `AUTH_SIGNUP_PROVIDER=cognito`, `AUTH_LAZY_MIGRATION=false`로 즉시 Cognito 경로 복귀(이미 이전된 사용자도 Cognito 비밀번호가 그대로이므로 로그인 가능). 코드 롤백 시 better-auth 쿠키를 가진 사용자는 재로그인 1회 필요.
**사용자 변화**: 가입 메일 발신자/문구 변경, 중복 가입 응답 변화, 로그인 유지 기간 30일로 명시, MFA 사용자 재등록 안내.

### Phase 5 — TOTP 재등록 UI·백업코드·2FA 로그인 완성

**변경 파일**
- api: `apps/api/src/auth/auth.controller.ts`에 `POST /api/auth/two-factor/enable`(`auth.api.enableTwoFactor({ body: { password }, headers })` → `totpURI`, `backupCodes`), `verify-setup`(`auth.api.verifyTOTP` — 등록 확인, 완료 시 `requiresTwoFactorSetup=false`), `disable`, `backup-codes/regenerate`. 모두 가드 보호 + `@Throttle`.
  - 주의: `auth.api.*`에 넘기는 `headers`는 `Authorization: Bearer <세션 토큰>`이어야 한다(JWT가 아님). web이 `refresh_token` 쿠키를 함께 전달하도록 `apiClient`에 `withSessionToken` 옵션 추가(`X-Session-Token` 헤더 → api가 Bearer로 변환). 이 옵션은 2FA 관리·로그아웃·비밀번호 변경에만 사용.
- web: `apps/web/app/(app)/settings/security/page.tsx`에 "2단계 인증" 섹션(`components/settings/two-factor-section.tsx`): QR(클라이언트 렌더, 예: `qrcode` 패키지), 코드 확인, 백업코드 표시/다운로드, 해제. `actions/two-factor.ts` 서버 액션(Sentry 래핑, Zod).
- web `login-form.tsx`: MFA 화면 문구를 "인증 앱 코드 또는 백업코드"로, `trustDevice` 체크박스(30일) 추가(선택).
- 메일 `templates/reenroll-mfa.ts`: 이전된 Cognito MFA 사용자에게 재등록 안내 1회 발송(배치 스크립트 `apps/api/scripts/send-mfa-reenroll-notice.ts`).

**패키지**: web `qrcode`(또는 `react-qr-code`). **환경변수**: 없음. **마이그레이션**: 없음.
**검증**: 등록 → 로그아웃 → 로그인 시 TOTP 요구 → 백업코드로 로그인 → 코드 소진 확인 → 해제. 10회 실패 → `ACCOUNT_TEMPORARILY_LOCKED`(429) 한국어 메시지.
**롤백**: 코드 롤백. `two_factors` 데이터 잔존 무해(로그인 시 `twoFactorEnabled` 기준).
**사용자 변화**: 보안 설정 페이지에 2단계 인증 추가. MFA 재등록 요구.

### Phase 6 — 잔여 사용자 처리 및 Cognito 제거

전제: Phase 4 배포 후 **≥30일**(Cognito refresh token 수명) 경과, 미이전 사용자 비율 확인.

**작업**
1. 미이전 사용자(`cognito_migrated_at IS NULL AND accounts 없음`) 집계 → 안내 메일(비밀번호 재설정 링크 대신 "로그인 시 재설정 코드 요청" 안내) 1회 발송. 1~2주 추가 대기.
2. `AUTH_ACCEPT_COGNITO_TOKENS=false` 배포 → 남은 Cognito 세션 강제 종료(재로그인 1회).
3. 코드 제거: `apps/api/src/auth/cognito.service.ts`, `cognito-migration.hook.ts`의 Cognito 분기, `AuthController`의 `new-password`·Cognito 분기, `jwt-auth.guard.ts`의 Cognito 경로, `apps/web/actions/auth.ts`/`proxy.ts`/`(auth)/layout.tsx`/`logout/route.ts`의 `cognito_username` 잔재, `respondToNewPassword` 액션과 폼 분기, `schemas/auth.ts`의 `newPasswordSchema`.
4. 패키지 제거: api `@aws-sdk/client-cognito-identity-provider`, `aws-jwt-verify`, (미사용) `@nestjs/jwt`.
5. 환경변수 제거: `COGNITO_USERPOOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`, `AUTH_ACCEPT_COGNITO_TOKENS`, `AUTH_SIGNUP_PROVIDER`, `AUTH_LAZY_MIGRATION`.
6. 문서: `CLAUDE.md`(인증 설명·환경변수), `apps/web/app/(legal)/privacy/page.tsx`의 "Amazon Cognito" 문구 2곳 수정(법무 확인 §8).
7. 유저풀: 삭제 보호 해제 전 **최종 export 1회 보관** 후 폐기(또는 90일 보관 후 삭제).
8. 선택: 응답 필드 `cognitoUsername` → `userId`로 개명(web 동시 배포).

**마이그레이션**: `drop_cognito_migration_columns`(선택, `cognito_mfa_enabled` 제거). `cognito_migrated_at`은 감사용으로 유지 권장.
**검증**: 전체 인증 체크리스트 재실행, 번들에 `@aws-sdk/client-cognito-identity-provider` 없음, Sentry에 Cognito 관련 에러 0.
**롤백**: 유저풀을 폐기하기 전까지는 코드 롤백으로 복귀 가능. **유저풀 폐기 이후에는 되돌릴 수 없다** — 이 단계만 비가역.
**사용자 변화**: 잔여 Cognito 세션 재로그인, 미이전자 재설정.

### Phase 7 — Google 로그인 추가 (Cognito 제거 이후, 선택)

전제: Phase 6 완료(모든 사용자가 `users`에 존재). Phase 6 이전에 하려면 아래 "ID 보존 훅"이 필수다.

**설계**
- better-auth `socialProviders.google`에 **로그인 전용 OAuth 클라이언트**를 쓴다. 기존 캘린더/주소록 연동(`apps/api/src/google/*`, `external_service_tokens`, 환경변수 `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`)과 분리한다. 같은 클라이언트에 리다이렉트 URI만 추가해도 동작하지만, 로그인(openid/email/profile)과 캘린더(offline access, calendar/contacts 스코프)의 동의 화면·토큰 수명이 섞이는 것을 피하기 위해 분리를 권장한다. 캘린더 토큰을 better-auth `accounts`로 옮기는 것은 범위 밖.
- 흐름(web·api 도메인이 다르고 web이 자체 쿠키를 쓰는 구조에 맞춤):
  1. web `/login`의 "Google로 계속" 버튼 → 서버 액션 `signInWithGoogle` → api `POST /api/auth/social/google/start` → api가 `auth.api.signInSocial({ body: { provider: 'google', callbackURL: '<BETTER_AUTH_URL>/api/auth/social/complete', errorCallbackURL: '<WEB_URL>/login?error=social' } })` → 반환된 `url`로 web이 브라우저를 리다이렉트.
  2. Google → `GET <BETTER_AUTH_URL>/api/better-auth/callback/google`(better-auth 핸들러, Google 콘솔에 등록할 리다이렉트 URI) → better-auth가 사용자/계정 생성 또는 연결, **api 도메인**에 세션 쿠키 설정 → `callbackURL`로 리다이렉트.
  3. api `GET /api/auth/social/complete`(@Public, Nest): 브라우저가 보낸 api 도메인 세션 쿠키로 `auth.api.generateOneTimeToken({ headers })` → `302 <WEB_URL>/auth/social/callback?token=<ott>`. 세션 쿠키는 즉시 만료 처리(api 도메인에 세션 쿠키를 남기지 않음).
  4. web `app/auth/social/callback/route.ts`: api `POST /api/auth/social/exchange { token }` → api가 `auth.api.verifyOneTimeToken` → 세션 토큰 → `auth.api.getToken`으로 JWT → `{ accessToken, refreshToken, expiresIn, cognitoUsername: user.id }`(로그인 응답과 동일 형태) → web이 `setTokenCookies` 재사용 → `/dashboard`.
- **계정 연결**: 같은 이메일의 기존 사용자(백필된 Cognito sub)는 better-auth가 자동 연결한다(Google은 이메일 검증 제공, 기존 사용자 `emailVerified` true 필요). 비밀번호를 한 번도 옮기지 않은 사용자도 Google로 바로 로그인할 수 있고, 이후 비밀번호 로그인은 lazy migration을 그대로 탄다.
- **ID 보존 훅(Phase 6 이전에 도입할 경우)**: `databaseHooks.user.create.before`에서 `users`에 없는 이메일이면 Cognito `ListUsers(filter email)`로 sub를 찾아 `id`로 사용한다. 그렇지 않으면 export 이후 가입한 Cognito 사용자가 Google 로그인 시 새 UUID로 중복 생성되어 기존 Organization과 끊긴다.
- **동의 이력**: 소셜 가입에는 가입 폼이 없다. 로그인 페이지의 Google 버튼 앞에 동의 체크 3종을 두고 동의 상태를 5분 쿠키(`social_consent`)에 보관 → 4단계 교환 시 `ConsentsService.recordSafely`. 누락 시 기존 `ReconsentModal`이 앱 사용을 막으므로 안전망이 있다.
- **2FA**: better-auth는 소셜 로그인에 2FA를 강제하지 않는다. TOTP 사용자가 Google로 로그인하면 2FA를 건너뛰게 되므로, `hooks.after`에서 `ctx.path === '/callback/:id'`이고 `newSession.user.twoFactorEnabled`면 세션을 폐기하고 2FA 챌린지로 보내는 처리를 넣는다(또는 Phase 7 초기에는 "2FA 사용자는 Google 로그인 불가" 안내).
- **Organization 부트스트랩**: `databaseHooks.user.create.after`(Phase 2) 그대로 동작.

**변경 파일**
- api: `auth.config.ts`(`socialProviders.google`, `oneTimeToken({ storeToken: 'hashed' })`, `account.accountLinking.trustedProviders: ['google']`, after 훅), `auth.controller.ts`(`social/google/start`, `social/complete`, `social/exchange`), `.env.example`.
- web: `app/(auth)/login/login-form.tsx`(버튼·동의 체크), `actions/auth.ts`(`signInWithGoogle`), `app/auth/social/callback/route.ts`, `utils/api/auth.ts`, `proxy.ts` matcher에 `auth/social` 제외 확인(기존 `auth` 접두 제외 규칙으로 이미 제외됨).

**패키지**: 없음(better-auth 내장). **환경변수(api)**: `GOOGLE_AUTH_CLIENT_ID`, `GOOGLE_AUTH_CLIENT_SECRET`(기존 캘린더용 `GOOGLE_CLIENT_ID`와 별도). Google 콘솔 리다이렉트 URI: `<BETTER_AUTH_URL>/api/better-auth/callback/google`. **마이그레이션**: 없음(`accounts` 테이블 재사용).
**검증**: (1) 신규 Google 가입 → `users`/`accounts(providerId=google)`/`organizations`/`user_consents` 생성, (2) 기존 이메일 사용자 Google 로그인 → 새 `users` 행 없이 `accounts` 연결, 기존 데이터 유지, (3) 동의 미체크 상태 → 버튼 비활성, (4) 2FA 사용자 Google 로그인 → 챌린지 또는 차단, (5) 일회용 토큰 재사용 → 401, 3분 후 만료, (6) 캘린더 연동 연결/해제가 영향 없음.
**롤백**: `socialProviders` 제거 배포. 이미 연결된 `accounts(google)` 행은 무해.
**사용자 변화**: 로그인 페이지에 Google 버튼.

---

## 6. 위험 요소와 완화책

| 위험 | 내용 | 완화 |
|---|---|---|
| refresh 흐름(`proxy.ts`, `(auth)/layout.tsx`) | 두 곳이 `refresh_token && cognito_username` 조건이라 better-auth 쿠키(username 없음)에서 갱신을 건너뛰고 로그인으로 보냄 | Phase 4에서 조건을 `refreshToken`만으로 변경. api `refresh`가 토큰 형태로 Cognito/better-auth를 판별. 단위 테스트 추가 |
| `refresh_token` 쿠키 수명 | 현재 `maxAge` 없음(세션 쿠키) → 브라우저 종료 시 소실 | better-auth 세션 30일에 맞춰 `maxAge` 명시 |
| 기존 `/api/auth` 경로 충돌 | better-auth 기본 `basePath`가 `/api/auth` | `basePath: '/api/better-auth'`로 고정. 경로 상수를 한 곳(`auth.config.ts`)에서 관리 |
| 로그인 중인 사용자의 세션 단절 | Phase 4 배포 후 Cognito 쿠키 사용자 | Phase 3 가드 dual-accept + Cognito refresh 경로 유지로 끊김 없음. Phase 6 토큰 수용 중단 시에만 1회 재로그인(사전 공지) |
| CloudFront 서명 쿠키 | 정책 경로가 `users/{userId}/*` | userId 보존으로 무영향. 발급 조건은 가드 통과 여부뿐 → Phase 3에서 회귀 테스트 |
| CalDAV/CardDAV AppToken | Basic auth + 토큰 해시, Cognito 비의존 | 무영향. 이메일 대조 미수행은 기존 상태(범위 밖 개선 후보) |
| 이메일 발송 실패 | SES 샌드박스/미인증 도메인/스로틀 | Phase 0에서 확인, `MAIL_TRANSPORT=log` 로컬 대체, 실패 Sentry 알림, 재발송 버튼 유지(`resend-verification` 5회/분) |
| 메일 타이밍 공격 | 발송 await로 사용자 존재 여부 노출 | 문서 권고대로 `void send()`; `onExistingUserSignUp` 안내 메일 |
| `Session` 모델 이름 충돌 | Prisma 모델 `Session`/테이블 `sessions` 기존 | `AuthSession`/`auth_sessions`, `session.modelName: 'authSession'`. 기동 시 better-auth 스키마 검증으로 조기 발견 |
| better-auth 스키마 검증이 요청을 지연 | 1.7.x는 첫 요청이 검증 완료까지 대기 | 배포 직후 헬스 체크(`/api/better-auth/ok`)로 워밍업. 불일치 시 로그 즉시 확인 |
| CLI `generate`가 `schema.prisma`를 덮어씀 | `@@map` 관례 소실 위험 | 항상 `--output <scratch>`로 생성해 수동 병합. 레포 스키마에 직접 쓰지 않는다 |
| Next.js 16 호환 | web에 better-auth 미설치 → 런타임 호환 이슈 없음. api는 Node 라이브러리로만 사용 | peer `next ^16` 확인됨. 추후 web 클라이언트 도입 시 재검토 |
| MFA 다운그레이드 | Cognito MFA 사용자가 이전 직후 2FA 없이 로그인 가능 | `requiresTwoFactorSetup` 강제 리다이렉트 + 안내 메일 + 유예기간 후 미등록 시 로그인 차단 옵션(§8) |
| 비밀번호 정책 불일치 | Cognito 복잡도 규칙 vs better-auth 길이만 | web Zod + api DTO에 동일 정규식 유지(§3.8) |
| 중복 가입 응답 변화 | 409 → 200(열거 방지) | 가입 폼 문구를 "입력한 이메일로 인증 코드를 보냈습니다"로 통일, 기존 사용자에겐 `onExistingUserSignUp` 메일 |
| JWT 키 관리 | `jwks.private_key`가 `BETTER_AUTH_SECRET`으로 암호화 | 시크릿 회전 시 키 재생성 필요 → 로테이션 절차 문서화. `rotationInterval` 미설정(필요 시 추후) |
| 이메일 대소문자/중복 | Cognito는 이메일 alias 대소문자 비구분 가능 | Phase 0 export에서 `lower(email)` 중복 검사, better-auth `email @unique`는 대소문자 구분 → 가입/로그인 시 소문자 정규화 훅 |
| Google 로그인 교차 도메인 | api 도메인에 세션 쿠키가 설정되고 web은 자체 쿠키를 씀 | oneTimeToken으로 전달하고 api 세션 쿠키는 즉시 만료. web/api가 같은 상위 도메인이면 `crossSubDomainCookies` 대안 검토 |
| Google 로그인 ID 중복 | export 이후 가입한 Cognito 사용자가 Google로 먼저 로그인하면 새 UUID 생성 | Phase 6 이후에 도입하거나 `user.create.before`에서 Cognito sub 조회 |
| Google 로그인 2FA 우회 | 소셜 로그인은 2FA 미적용(패키지 코드 확인) | `/callback/:id` after 훅으로 2FA 챌린지 강제 |
| 운영 중 Cognito 장애·요금 | 병행 기간 Cognito 호출 지속 | lazy migration 성공 시 이후 호출 없음. 30일 후 종료 |
| 테스트 범위 | 가드·훅·refresh 판별 회귀 | 기존 api vitest(`*.spec.ts`, mock 주입)로 가드·에러맵·refresh 판별·lazy migration 훅 단위 테스트 추가 |
| 동의 이력과 열거 방지 | 중복 가입 응답의 합성 `user.id`로 `user_consents`를 기록하면 존재하지 않는 사용자 행이 생김 | 가입 후 `users`를 이메일로 조회해 id 일치 시에만 기록(Phase 4) |
| 미인증 사용자 로그인 시 OTP 재발송 | `requireEmailVerification`이면 로그인 시도마다 OTP 메일 발송 | `/api/auth/login` Throttler(10회/분) 유지 + emailOTP `resendStrategy: 'reuse'` 검토 |

---

## 7. 범위 밖 (명시)

- Google 외 소셜 로그인(Apple, Kakao, Naver 등). Google은 Phase 7로 포함했고, 다른 제공자는 같은 구조(`socialProviders` 또는 `genericOAuth` 플러그인)로 추가 가능하다.
- 조직 다중 멤버십(better-auth `organization` 플러그인 포함). 현재 `Organization.userId` 1:N 소유 모델 유지.
- 기존 테이블 `user_id` 컬럼에 대한 FK 추가·재작성, `Student.userId`/`Meeting.userId` 제거.
- CalDAV AppToken 인증의 이메일 대조 강화.
- Paddle 웹훅(서명 검증 기반, 인증과 무관), Google 연동 OAuth(로그인 아님) 로직 변경.
- 비밀번호 변경(로그인 상태) UI 신설 — 현재도 없으며, 필요 시 Phase 5에 `auth.api.changePassword`로 추가 가능.

---

## 8. 열린 질문

1. **Cognito 메일 발신 구성**: 현재 Cognito가 SES 인증 도메인으로 발송 중인가, Cognito 기본 발신자인가? SES 샌드박스 해제 상태인가? (Phase 0 확인 → SES vs Resend 최종 결정)
2. **기존 MFA 사용자 수와 정책**: 재등록 유예기간을 얼마나 둘지, 유예 후 미등록 시 로그인 차단할지, 아니면 안내만 할지.
3. **비밀번호 정책**: Cognito 복잡도 규칙(대/소/숫/특수)을 유지할지, 길이 8 이상으로 완화할지.
4. **중복 가입 응답**: 열거 방지(200)로 바꿀지, `requireEmailVerification`을 끄고 지금처럼 409를 유지할지(이 경우 `autoSignIn: false` + 수동 `sendVerificationOTP`로 흐름 구성).
5. **세션 수명**: 30일 슬라이딩(`updateAge` 1일)으로 충분한가, 더 짧게/길게 할지. `rememberMe` 미체크 시 브라우저 세션으로 둘지.
6. **2FA 재등록 유예 후 처리**: 유예기간이 끝난 미등록 사용자를 로그인 차단할지, 안내만 유지할지. (참고: 등록 단계의 `verifyTOTP`는 패키지 코드 확인 결과 세션이 있으면 세션을, 없으면 two_factor 쿠키를 쓰므로 Bearer 세션 토큰만으로 동작한다.)
7. **잔여 미이전 사용자 처리 시점**: Phase 4 후 30일 기준이 적절한가, Cognito refresh token 수명 설정값 확인 필요.
8. **개인정보처리방침 문구**: `apps/web/app/(legal)/privacy/page.tsx`의 "Amazon Cognito" 2곳 수정 시점과 문구(법무 검토).
9. **`cognitoUsername` 응답 필드/`cognito_username` 쿠키 이름**: Phase 6에서 개명할지, 호환성을 위해 그대로 둘지.
10. **삭제된 Cognito 사용자의 잔존 데이터**: `organizations.user_id`에 있으나 유저풀에 없는 sub가 있다면 `users`에 플레이스홀더 행을 만들지, 그대로 둘지.
11. **JWT 만료 1시간**: 현재 Cognito 기본과 같지만, 15분(better-auth 기본)으로 줄이고 갱신을 더 자주 할지.
12. **Google 로그인 범위**: Phase 7을 Phase 6 이후로 미룰지(권장), Phase 4 직후에 넣을지. 캘린더 연동 OAuth 클라이언트와 분리할지. 소셜 가입 시 동의 수집을 버튼 앞 체크로 할지, `ReconsentModal`에만 맡길지. 2FA 사용자의 Google 로그인을 차단할지 챌린지로 보낼지.
13. **다중 api 인스턴스**: 가드의 JWKS 캐시는 인스턴스별이며 DB 기반이라 공유에 문제 없음. 다만 better-auth `rateLimit`(기본 메모리) 대신 기존 `@nestjs/throttler`만 쓰는 것으로 가정했는데, better-auth 핸들러 직접 노출(`/api/better-auth/*`)에도 Throttler를 걸어야 하는지.

---

## 부록 A. 참조한 문서 (better-auth GitHub `docs/content/docs`, 2026-10-04 기준 main)

`adapters/prisma.mdx`, `concepts/database.mdx`(핵심 스키마, 모델명/필드 매핑, ID 생성, databaseHooks, 스키마 검증), `plugins/bearer.mdx`, `plugins/jwt.mdx`, `plugins/2fa.mdx`, `plugins/email-otp.mdx`, `authentication/email-password.mdx`, `concepts/session-management.mdx`, `concepts/hooks.mdx`, `concepts/users-accounts.mdx`(setPassword), `reference/options.mdx`(basePath, trustedOrigins, advanced.database.generateId, rateLimit), `integrations/next.mdx`, `integrations/nestjs.mdx`, `integrations/fastify.mdx`, `concepts/cli.mdx`. npm: `better-auth@1.7.7`, `@better-auth/prisma-adapter@1.7.7`, `@better-auth/cli@1.4.21`, `jose@6.2.12`, `@aws-sdk/client-sesv2@3.1146.0`.

## 부록 B. 이번에 읽은 레포 파일

`apps/api/src/auth/{auth.controller,auth.service,auth.module,cognito.service}.ts`, `apps/api/src/auth/guards/jwt-auth.guard.ts`, `apps/api/src/auth/dto/*.ts`, `apps/api/src/common/decorators/*.ts`, `apps/api/src/common/filters/http-exception.filter.ts`, `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/app-tokens/app-tokens.service.ts`, `apps/api/src/carddav/{carddav.controller.ts,guards/carddav-auth.guard.ts}`, `apps/api/src/google/google.controller.ts`(일부), `apps/api/src/subscriptions/paddle-webhook.controller.ts`(일부), `apps/api/src/s3/s3.service.ts`(서명 쿠키), `apps/api/prisma/schema.prisma`, `apps/api/prisma.config.mjs`, `apps/api/package.json`, `apps/api/.env.example`, `apps/web/actions/auth.ts`, `apps/web/utils/{api-client,auth}.ts`, `apps/web/utils/api/auth.ts`, `apps/web/proxy.ts`, `apps/web/app/auth/{logout,cloudfront/cookies,google/callback}/route.ts`, `apps/web/app/(auth)/{layout.tsx,login/login-form.tsx,verify-email/page.tsx,reset-password/page.tsx}`, `apps/web/app/(app)/settings/security/page.tsx`, `apps/web/schemas/auth.ts`, `apps/web/vitest.config.ts`, `apps/web/tests/setup.ts`, `apps/web/package.json`, `apps/web/.env.example`, `pnpm-workspace.yaml`, `package.json`, `turbo.json`.
