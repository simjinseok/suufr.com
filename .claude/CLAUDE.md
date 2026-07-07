# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

스프(Suufr) - 과외 일정 및 수업 관리 도구. 달 단위로 수업 횟수와 입금 내역을 관리할 수 있는 튜터링 관리 앱.

## Monorepo Layout

Turborepo + pnpm workspaces. 두 앱 + 공유 설정 패키지로 구성:

- **`apps/web`** — Next.js 16 (App Router) 프론트엔드. **Prisma를 직접 쓰지 않는다.** 모든 데이터 접근은 HTTP로 `apps/api`를 호출한다 (`utils/api-client.ts`, `utils/api/*`). 서버 액션은 Zod 검증 + `Sentry.withServerActionInstrumentation`으로 감싼 얇은 프록시.
- **`apps/api`** — NestJS 11 (Fastify) 백엔드. Prisma 7로 PostgreSQL 접근, AWS Cognito 인증, S3/CloudFront 파일 저장. 소유권 격리·소프트 삭제 등 도메인 규칙이 여기 있다.
- **`packages/*`** — 공유 설정 (`@suufr/eslint-config`, `@suufr/typescript-config`).

## Development Commands

```bash
pnpm dev                           # 전체(turbo) 개발 서버
pnpm build                         # 전체 빌드
pnpm lint                          # 전체 lint

# 개별 앱
pnpm --filter web dev
pnpm --filter api start:dev

# DB / Prisma (apps/api 전용)
pnpm --filter api prisma:generate  # Prisma Client 생성
pnpm --filter api prisma:migrate   # 마이그레이션 (dev)
pnpm --filter api prisma:deploy    # 마이그레이션 적용 (prod)
pnpm --filter api prisma:studio
```

## Tech Stack

**apps/web**: Next.js 16 (App Router), React 19, TypeScript, HeroUI v3 (beta), Tailwind CSS 4, React Hook Form + Zod, Sentry. 데이터는 `apps/api`를 HTTP로만 호출 (Prisma 없음).

**apps/api**: NestJS 11 + Fastify, Prisma 7 (`prisma-client` 제너레이터 + `@prisma/adapter-pg` 드라이버 어댑터, 설정은 `apps/api/prisma.config.mjs`), PostgreSQL, AWS Cognito (`aws-jwt-verify`), S3 + CloudFront, `@nestjs/throttler`, Sentry.

> **Prisma 버전 주의**: CLI(`prisma`)와 런타임(`@prisma/client`, `@prisma/adapter-pg`)의 버전이 **정확히 일치**해야 한다. 어긋나면 클라이언트 생성/런타임에서 깨진다.

## Tailwind CSS 4 Guidelines (apps/web)

This project uses **Tailwind CSS 4** with CSS-first configuration. Do NOT use v3 syntax.

**Configuration:**
- CSS-first setup via `@import "tailwindcss"` in globals.css
- Theme variables defined in `@theme {}` block
- No tailwind.config.ts file (not needed in v4)

**Color Usage:**
- HeroUI semantic: `accent`, `danger`, `warning`, `success`, `default` (+ soft variants: `bg-accent-soft` 등)
- Tailwind palette: `gray`, `zinc`, `blue`, `green`, `purple`, `violet`, `indigo`, `red`, `amber`, `emerald`
- Arbitrary values (`bg-[#xxx]`)는 팔레트에 없는 특정 색이 필요할 때만

**v3 → v4 Breaking Changes:**
| v3 (DO NOT USE) | v4 (USE THIS) |
|-----------------|---------------|
| `shadow-sm` | `shadow-xs` |
| `shadow-md` | `shadow-sm` |
| `rounded-sm` | `rounded-xs` |
| `blur-sm` | `blur-xs` |
| `ring-offset-*` | `inset-ring-*` |
| `bg-opacity-50` | `bg-black/50` |
| `flex-grow` / `flex-shrink` | `grow` / `shrink` |
| `overflow-ellipsis` | `text-ellipsis` |

## Architecture

```
apps/web/
  app/
    (app)/            # 인증된 라우트 (dashboard, students, payments, calendar, sessions, settings ...)
    (auth)/           # 로그인/회원가입/비밀번호 등
    (student)/sl/     # 공개 공유 수업 뷰 (비로그인)
    api/              # Next Route Handlers (스토리지 프록시, OAuth 콜백 등)
    auth/             # OAuth/쿠키 핸들러
  actions/            # 서버 액션 (Sentry 래핑, API 호출 프록시)
  utils/api-client.ts # API HTTP 클라이언트 (access_token 쿠키 → Bearer)
  utils/api/*         # 도메인별 API 래퍼
  schemas/            # Zod 스키마
  components/         # 도메인별 컴포넌트

apps/api/src/
  <domain>/           # 도메인별 module/controller/service/dto (students, lessons, sessions, payments ...)
  auth/               # Cognito 인증, JwtAuthGuard, @Public 데코레이터
  common/             # 전역 가드/필터/데코레이터, 공용 util·constants
  prisma/             # PrismaService (드라이버 어댑터 기반)
  storage/            # S3 업로드/쿼터/폴더
  s3/                 # S3 + CloudFront 래퍼
  prisma/schema.prisma
```

## Key Patterns

**인증 (api)**: 전역 `JwtAuthGuard`(APP_GUARD)가 모든 라우트를 보호하고, 공개 엔드포인트는 `@Public()`으로 표시. Cognito access token을 `aws-jwt-verify`로 검증하고 `@CurrentUser()`로 주입.

**멀티테넌트 격리 (api)**: 모든 조회/변경은 `organization.userId`(또는 `mediaFile.userId`) 소유권 확인 후 수행. id/uuid 단독으로 mutate 하지 않는다.

**소프트 삭제 (api)**: 모델에 `deletedAt` 필드. 조회는 `WHERE deletedAt IS NULL` 필터.

**서버 액션 (web)**: 모든 액션을 `Sentry.withServerActionInstrumentation`으로 감싸고, Zod로 입력 검증, mutation 후 `revalidatePath`.
```typescript
export async function updateX(prevState, formData) {
  return await Sentry.withServerActionInstrumentation(
    'updateX',
    { formData, headers: await headers(), recordResponse: true },
    async () => { /* 검증 → API 호출 → revalidatePath */ },
  );
}
```

**Modal 패턴 (HeroUI v3, web)**:
```typescript
<Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
  <Modal.Container>
    <Modal.Dialog>
      {({ close }) => <Content close={close} />}
    </Modal.Dialog>
  </Modal.Container>
</Modal.Backdrop>
```

**날짜 처리**: 월/연 경계 같은 비즈니스 계산은 **서버 로컬시간이 아니라 KST 기준**으로 한다. api는 `common/utils/kst.ts`, web은 `utils/kst.ts`(동일 로직 미러)의 `kstMonthStart`/`toKstParts` 사용. 폼 입력은 `@internationalized/date`의 `parseDate(...).toDate('Asia/Seoul')` 패턴.

## Database Models (apps/api/prisma/schema.prisma)

핵심 모델: User(Cognito), Organization, Student, Lesson, Session, Payment, Meeting, Feedback, LessonShare, Folder, MediaFile, UserStorageQuota

- Students status: pending | active | paused | leave (StudentStatus 이력으로 추적)
- 금액은 정수(원). 파일 크기/쿼터는 BigInt.

## Prisma Schema Changes

스키마 변경 시:
1. `apps/api/prisma/schema.prisma` 편집
2. `pnpm --filter api prisma:migrate -- --create-only`로 **적용 없이 마이그레이션 파일만 생성**
3. 설명적인 마이그레이션 이름 사용 (`add_user_avatar` 등)
4. 생성된 SQL 검토
5. `pnpm --filter api prisma:deploy`로 적용

**DO NOT** schema.prisma만 바꾸지 말 것. 항상 `--create-only`로 마이그레이션 파일을 먼저 생성한다. 마이그레이션 **파일명 정렬 순서 = 적용 순서**이므로, 나중에 만든 테이블을 앞선 타임스탬프의 마이그레이션이 ALTER 하지 않도록 주의.

## Environment Variables

**apps/api**: `POSTGRES_PRISMA_URL`, `COGNITO_USERPOOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`, `AWS_REGION`, `AWS_S3_BUCKET_NAME`, `AWS_S3_ACCESS_KEY`, `AWS_S3_SECRET_KEY`, `CLOUDFRONT_URL`/`CDN_URL`, `CLOUDFRONT_KEY_PAIR_ID`, `CLOUDFRONT_PRIVATE_KEY`, `WEB_URL`, `NODE_ENV`

**apps/web**: `API_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_CDN_URL`, `NEXT_PUBLIC_SENTRY_DSN`, Cognito/OAuth 관련

> `NODE_ENV=production`은 프로덕션에서 반드시 설정할 것 (쿠키 Secure 등 보안 동작이 이에 의존).
