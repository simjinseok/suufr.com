# Coolify 이전 작업계획 (GitHub Actions + GHCR)

기준 커밋: `3bbc96c` (main, "Cognito → better-auth 이전 (#24)")
작성일: 2026-10-05

## 0. 목표와 범위

- 현재: AWS CodeBuild(`apps/*/buildspec.yml`) → Elastic Beanstalk(Procfile, `.ebextensions`, `.platform/hooks`) 배포.
- 목표: GitHub Actions 가 web/api 컨테이너 이미지를 빌드해 GHCR(`ghcr.io`)에 push 하고, Coolify 가 그 이미지를 받아 실행한다.
- 범위 밖: DB(PostgreSQL), S3/CloudFront, SES, Cognito(이전 기간 병행), Paddle 은 그대로 둔다. Coolify 는 web·api 컨테이너 실행만 담당한다.

## 1. 사전 조사에서 확인한 사실 (더블체크 완료)

아래는 이 브랜치(main 기준)에서 실제로 명령을 실행해 확인한 것이다. Docker 데몬이 없는 환경이라 **이미지 빌드 자체는 미검증**이고, Dockerfile 과 같은 명령 순서를 호스트에서 돌려 확인했다.

| # | 항목 | 결과 |
|---|------|------|
| 1 | 저장소에 Dockerfile / `.github/workflows` / `.dockerignore` 없음 | 신규 작성 필요 |
| 2 | `pnpm install --frozen-lockfile` → `prisma generate` → `nest build` | 성공. `dist/generated/prisma` 생성됨, spec 파일은 `tsconfig.build.json` 으로 제외됨(dist 에 0개) |
| 3 | api 단위 테스트 `pnpm --filter api test:run` | 5 파일 36개 통과 |
| 4 | `pnpm --filter api deploy --prod --legacy <dir>` (pnpm 11) | `--legacy` 없이는 동작하지 않음. **`apps/api/.gitignore` 의 `generated` 패턴을 packlist 규칙으로 적용해 `dist/generated` 가 누락**되고 기동 시 `Cannot find module '../generated/prisma/client'` 로 죽는다 → `package.json` 에 `files: ["dist","prisma","prisma.config.mjs"]` 명시로 해결(이전 브랜치에서 검증) |
| 5 | deploy 디렉터리에서 `prisma migrate deploy` | `prisma.config.mjs` 로드·스키마 엔진 기동까지 정상(DB 미연결 에러 P1001 만 발생) |
| 6 | api 기동 필수 env | `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` 없으면 DI 단계에서 예외로 즉시 종료(`better-auth.provider.ts`) |
| 7 | JWT 검증 경로 | JWKS 를 DB 에서 읽어 로컬 검증(`jose.createLocalJWKSet`). api 가 자기 공개 URL 을 HTTP 로 호출하지 않으므로 컨테이너 내부 hairpin 문제 없음 |
| 8 | web `next build --webpack` (hoisted 설치) | 성공. `output: 'standalone'` + `outputFileTracingRoot` 가 모노레포 루트라 산출물은 `.next/standalone/apps/web/server.js`. `.next/static`, `public` 은 별도 복사 필요 |
| 9 | web standalone 기동 후 `/health`, `/login` | 200 응답. `/health` 는 `proxy.ts` matcher 에서 제외돼 인증 없이 접근 가능 |
| 10 | api `/health` | `SELECT 1` 로 DB 연결까지 확인 → Coolify 헬스체크가 DB 장애 시 컨테이너를 재시작시킬 수 있음(§6 참고) |
| 11 | web 테스트 | web 만 필터 설치하면 `constants/legal.test.ts` 가 `../../api/src/...` 를 import 해 실패. **전체 설치(`pnpm install` 무필터)에서는 13개 통과** → CI 테스트 잡은 무필터 설치 |
| 12 | Node 버전 | `engines.node >= 24`, `packageManager pnpm@11.17.0`. 이미지는 `node:24-bookworm-slim` 사용 |
| 13 | 네이티브 바이너리 | `@sentry/profiling-node` 는 linux-x64-glibc 프리빌드 사용(Debian slim 과 호환). Alpine(musl) 은 피한다 |
| 14 | 빌드 타임 인라인 env (web) | `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_CDN_URL`, `NEXT_PUBLIC_SENTRY_DSN` 만. `GA_MEASUREMENT_ID`, `PADDLE_*`, `API_URL`, `SENTRY_DSN` 은 런타임 |
| 15 | 프록시 뒤 동작 | api `trustProxy: true`, web/api 쿠키 `secure` 는 `NODE_ENV=production` 에 의존, CORS origin = `WEB_URL` |
| 16 | `.claude/` 는 main 에서 gitignore 처리됨 | CLAUDE.md 는 더 이상 저장소에 없음(계획과 무관, 참고) |

## 2. 결정이 필요한 사항 (작업 전 확정)

1. **Coolify 서버 아키텍처**: amd64 가정. ARM 이면 워크플로 `platforms` 에 `linux/arm64` 추가(빌드 시간 약 2배).
2. **도메인**: web `https://suufr.com`(가정), api `https://api.suufr.com`(가정). api 도메인은 `BETTER_AUTH_URL` 이자 JWT iss/aud 라서 **바꾸면 발급된 토큰이 전부 무효**. 기존 EB 의 api 도메인을 그대로 Coolify 로 옮기는 것을 권장.
3. **web → api 내부 통신**: 같은 Coolify 서버/네트워크면 `API_URL` 을 컨테이너 내부 주소(`http://<api-컨테이너명>:5001`)로 둘 수 있다. 단 `BETTER_AUTH_URL` 은 반드시 공개 URL 로 유지.
4. **GHCR 가시성**: 이미지를 private 로 두면 Coolify 서버에 GHCR 읽기 토큰(`read:packages`) 로그인이 필요. public 이면 불필요.
5. **마이그레이션 실행 위치**: 컨테이너 entrypoint 에서 `prisma migrate deploy` 실행(단일 인스턴스 전제). 레플리카를 늘릴 계획이면 `SKIP_MIGRATIONS=true` 로 끄고 Coolify "Pre-deployment command" 또는 Actions 잡으로 분리.

## 3. 작업 단계

### Phase A — 컨테이너화 (코드)

- [ ] `.dockerignore` (루트): `node_modules`, `.next`, `dist`, `src/generated`, `.env*`(example 제외), `.git`, 레거시 배포 파일.
- [ ] `apps/api/package.json` 에 `files` 필드 추가 (§1-4).
- [ ] `apps/api/Dockerfile` (컨텍스트 = 모노레포 루트)
  - deps: 매니페스트만 복사 → `pnpm install --frozen-lockfile --filter api...` (pnpm store 캐시 마운트)
  - build: 소스 복사 → `prisma:generate` → `nest build` → `pnpm --filter api deploy --prod --legacy /app/deploy`
  - runner: `node:24-bookworm-slim` + `openssl ca-certificates`(Prisma 스키마 엔진용) → `/app/deploy` 복사 → `USER node` → entrypoint
  - HEALTHCHECK: `GET /health` 의 `status === 'ok'`
- [ ] `apps/api/docker-entrypoint.sh`: `SKIP_MIGRATIONS` 가 `true` 가 아니면 `./node_modules/.bin/prisma migrate deploy` 후 `exec node dist/main.js`.
- [ ] `apps/web/Dockerfile`
  - deps: `pnpm install --frozen-lockfile --filter web... --config.node-linker=hoisted` (buildspec 과 동일. standalone 추적이 hoisted 레이아웃 전제)
  - build: `ARG NEXT_PUBLIC_*`, `SENTRY_ORG/PROJECT` → `ENV` → `NODE_ENV=production pnpm --filter web build`. `SENTRY_AUTH_TOKEN` 은 `--mount=type=secret` 으로만.
  - runner: standalone 복사 + `.next/static`, `public` 복사 → `HOSTNAME=0.0.0.0 PORT=3000` → `node apps/web/server.js`
  - HEALTHCHECK: `GET /health`
- [ ] 로컬 Docker 가 있는 환경에서 `docker build -f apps/api/Dockerfile .` / `-f apps/web/Dockerfile .` 통과 확인 (이 저장소 세션에서는 불가 → Actions 첫 실행이 사실상 첫 빌드).

### Phase B — GitHub Actions → GHCR

- [ ] `.github/workflows/deploy.yml`
  - trigger: `push` to `main`, `workflow_dispatch`
  - job `test`: 무필터 `pnpm install` → `pnpm --filter api test:run`, `pnpm --filter web test:run`, (선택) `pnpm lint`
  - job `build` (matrix `web`/`api`, `needs: test`): buildx → `docker/login-action`(GHCR, `GITHUB_TOKEN`, `packages: write`) → `docker/metadata-action`(`latest` on main + `sha-<short>`) → `docker/build-push-action`(`cache-from/to: type=gha`, web 은 `build-args`/`secrets`)
  - job `deploy` (`needs: build`, main 만): Coolify 웹훅 호출. 시크릿 없으면 skip.
- [ ] GitHub 설정
  - Variables: `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_CDN_URL`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`
  - Secrets: `SENTRY_AUTH_TOKEN`(선택), `COOLIFY_TOKEN`, `COOLIFY_WEBHOOK_WEB`, `COOLIFY_WEBHOOK_API`
  - 첫 push 후 GHCR 패키지 가시성/권한 확인(기본 private).
- [ ] 첫 실행은 `workflow_dispatch` 로 수동 트리거해 이미지 빌드만 확인(Coolify 웹훅 시크릿은 아직 비워 둠).

### Phase C — Coolify 리소스 구성 (콘솔 작업)

- [ ] (private 이미지일 때) Coolify 서버에서 `docker login ghcr.io` 또는 Coolify 의 Docker registry 설정.
- [ ] 리소스 `suufr-api`: 타입 Docker Image, `ghcr.io/simjinseok/suufr-api:latest`, 포트 5001, 도메인 = 기존 api 도메인, 헬스체크 `/health`.
- [ ] 리소스 `suufr-web`: `ghcr.io/simjinseok/suufr-web:latest`, 포트 3000, 도메인 = 기존 web 도메인, 헬스체크 `/health`.
- [ ] 환경변수 입력 (§4 표). 특히 `NODE_ENV=production`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`(EB 와 **같은 값**이어야 세션 유지), `MAIL_TRANSPORT=ses`.
- [ ] Coolify 서버에서 DB(RDS 등)·S3·SES 로 아웃바운드가 열려 있는지 확인(보안그룹/IP 허용 목록에 Coolify 서버 IP 추가).
- [ ] 각 리소스의 Webhooks 탭 URL 과 API 토큰을 GitHub Secrets 에 등록.

### Phase D — 전환(cutover)

- [ ] Coolify 에 임시 도메인(또는 hosts 파일)으로 올려 로그인·가입(OTP 메일)·2FA·파일 업로드·Paddle 웹훅 수신까지 수동 점검.
- [ ] `prisma migrate deploy` 가 entrypoint 에서 정상 완료되는지 로그 확인(EB 와 같은 DB 를 쓰므로 이미 적용된 상태라 no-op 이어야 함).
- [ ] DNS 를 Coolify 로 전환(TTL 을 미리 낮춰 둠). Google Calendar 웹훅(`GOOGLE_WEBHOOK_URL`)·Paddle notification URL 이 api 도메인을 가리키므로 도메인이 바뀌면 각 콘솔에서 갱신.
- [ ] EB 환경은 바로 지우지 않고 1~2일 유지(롤백용).

### Phase E — 정리

- [ ] 레거시 삭제: `apps/*/buildspec.yml`, `apps/*/Procfile`, `apps/web/.ebextensions`, `apps/api/.platform`. 삭제 전 `pnpm-workspace.yaml` 의 `verifyDepsBeforeRun: false` 주석(buildspec 언급)도 갱신.
- [ ] `.env.example` 에 `SKIP_MIGRATIONS` 설명 추가, README 에 배포 흐름 한 단락 추가.
- [ ] EB/CodeBuild 리소스 삭제.

## 4. 환경변수 매핑

### web

| 변수 | 시점 | 비고 |
|------|------|------|
| `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_CDN_URL`, `NEXT_PUBLIC_SENTRY_DSN` | **빌드**(GitHub Variables → build-arg) | 값 바꾸면 재빌드 필요 |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | 빌드(선택) | 소스맵 업로드. 토큰 없으면 경고만 내고 통과(확인됨) |
| `API_URL` | 런타임 | api 공개 URL 또는 Coolify 내부 주소 |
| `NODE_ENV=production` | 런타임 | 쿠키 `secure` 에 필요. Dockerfile 에 기본값으로 박음 |
| `GA_MEASUREMENT_ID`, `PADDLE_CLIENT_TOKEN`, `PADDLE_ENV`, `PADDLE_PRICE_ID_PRO`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT` | 런타임 | |
| `PORT=3000`, `HOSTNAME=0.0.0.0` | 런타임 | Dockerfile 기본값 |

### api (전부 런타임)

| 그룹 | 변수 |
|------|------|
| 필수(없으면 기동 실패) | `POSTGRES_PRISMA_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` |
| 코어 | `NODE_ENV=production`, `PORT=5001`, `WEB_URL`, `TOKEN_ENCRYPTION_KEY`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT` |
| Cognito 병행(Phase 6 전까지) | `COGNITO_USERPOOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`, `AUTH_LAZY_MIGRATION`, `AUTH_ACCEPT_COGNITO_TOKENS` |
| 메일 | `MAIL_TRANSPORT=ses`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`, `MAIL_REPLY_TO`, `AWS_SES_REGION`, `AWS_SES_ACCESS_KEY`, `AWS_SES_SECRET_KEY` |
| 스토리지 | `AWS_REGION`, `AWS_S3_BUCKET_NAME`, `AWS_S3_ACCESS_KEY`, `AWS_S3_SECRET_KEY`, `CLOUDFRONT_URL`, `CDN_URL`, `CLOUDFRONT_DISTRIBUTION_ID`, `CLOUDFRONT_KEY_PAIR_ID`, `CLOUDFRONT_PRIVATE_KEY`, `CLOUDFRONT_COOKIE_DOMAIN` |
| 연동 | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_WEBHOOK_URL`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_ENV`, `NEXT_PUBLIC_BASE_URL` |
| 컨테이너 전용 | `SKIP_MIGRATIONS`(기본 false) |

EB 환경변수를 그대로 export 해 Coolify 에 붙여넣되, **EB 에만 있던 IAM 인스턴스 역할 기반 자격증명은 Coolify 에 없다**. S3/SES 가 역할에 기대고 있었다면 액세스 키를 발급해 넣어야 한다.

## 5. 검증 체크리스트

- [ ] Actions: test → build(web, api) → push 성공, GHCR 에 `latest`/`sha-*` 태그 생성
- [ ] 이미지 크기 점검(api `node_modules` 약 590MB 예상. 줄이려면 후속으로 `@aws-sdk` 개별 패키지 정리)
- [ ] api 컨테이너 로그: `Running prisma migrate deploy` → `Nest application successfully started`
- [ ] `GET https://api.../health` → `{"status":"ok","database":"connected"}`
- [ ] `GET https://web.../health` → `{"status":"ok"}`
- [ ] 로그인 → `/dashboard` 진입, 쿠키 `Secure` 플래그 확인
- [ ] 가입 OTP 메일 수신(SES), 2FA 설정 QR 표시
- [ ] 파일 업로드/다운로드(S3, CloudFront 서명 쿠키 도메인)
- [ ] Sentry 에 web/api 이벤트 수신, 릴리즈/소스맵(토큰 설정 시)

## 6. 리스크와 대응

| 리스크 | 대응 |
|--------|------|
| api `/health` 가 DB 장애 시 `status: error` → Coolify 가 컨테이너를 unhealthy 로 보고 재시작 반복 | 재시작해도 해결되지 않으므로 헬스체크를 `/`(프로세스 생존만)로 두고 DB 는 Sentry/외부 모니터링으로 보는 것을 권장. 결정 필요 |
| `BETTER_AUTH_SECRET` 값이 EB 와 다르면 전환 순간 전 사용자 로그아웃 | EB 값 그대로 복사. 비밀값은 Coolify UI 에서만 입력 |
| api 도메인 변경 시 JWT iss/aud 불일치 | 도메인 유지. 바꿔야 한다면 사용자 재로그인 공지 |
| entrypoint 마이그레이션이 두 컨테이너에서 동시 실행 | Prisma 는 `_prisma_migrations` 락으로 보호되지만, Coolify 의 rolling update 중 구·신 컨테이너 동시 실행은 피할 수 없음 → 스키마 변경은 하위 호환으로 작성 |
| 첫 Actions 빌드 실패(이미지 빌드 미검증) | Dockerfile 명령 순서는 호스트에서 검증 완료. 실패 시 로그를 보고 수정, `workflow_dispatch` 로 재시도 |
| GHCR private 이미지 pull 실패 | §2-4. Coolify 배포 로그의 `unauthorized` 로 확인 |
| ARM 서버 | §2-1 |

## 7. 롤백

DNS 를 EB 로 되돌린다(TTL 낮춰둠). DB 스키마는 공유하므로 되돌릴 것 없음. EB 환경은 전환 후 최소 1~2일 유지.
