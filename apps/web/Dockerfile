# syntax=docker/dockerfile:1
#
# apps/web — Next.js 16 (App Router), output: 'standalone'
#
# 빌드 컨텍스트는 모노레포 루트다:
#   docker build -f apps/web/Dockerfile -t suufr-web .
#
# 두 가지가 특히 중요하다.
#
# 1) pnpm install 에 --config.node-linker=hoisted 가 반드시 필요하다.
#    기본(isolated) 레이아웃으로 설치하면 Next 의 output file tracing 이
#    심볼릭 링크를 따라가지 못해 standalone/node_modules 가 사실상 비게 된다.
#    pnpm-workspace.yaml 의 verifyDepsBeforeRun: false 도 이 때문에 켜져 있다.
#
# 2) NEXT_PUBLIC_* 는 빌드 타임에 번들로 인라인된다. 런타임 환경변수로는
#    절대 바뀌지 않으므로 build-arg 로 넣어야 한다. 서버 전용 변수
#    (API_URL, PADDLE_*, SENTRY_DSN 등)는 런타임 주입으로 충분하다.

ARG NODE_VERSION=24-slim

# ---------------------------------------------------------------------------
# base
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS base

ENV CI=true \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11 --activate

WORKDIR /app

# ---------------------------------------------------------------------------
# deps — 매니페스트만 먼저 복사해 install 레이어 캐시를 살린다.
#
# 와일드카드 COPY 는 경로를 평탄화해 서로 덮어쓰므로 디렉터리별로 명시한다.
# --frozen-lockfile 이 워크스페이스 전체를 락파일과 대조하므로 api 의
# package.json 도 있어야 한다.
# ---------------------------------------------------------------------------
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --config.node-linker=hoisted

# ---------------------------------------------------------------------------
# build
# ---------------------------------------------------------------------------
FROM deps AS build

ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_CDN_URL
ARG NEXT_PUBLIC_SENTRY_DSN

ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL} \
    NEXT_PUBLIC_CDN_URL=${NEXT_PUBLIC_CDN_URL} \
    NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN} \
    NODE_ENV=production

COPY . .

# SENTRY_AUTH_TOKEN 이 secret 으로 주어지면 소스맵을 업로드하고,
# 없으면 업로드만 조용히 건너뛴다 (빌드는 통과).
RUN --mount=type=secret,id=sentry_auth_token,required=false \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    pnpm turbo build --filter=web

# ---------------------------------------------------------------------------
# runner
#
# 복사 규칙은 기존 apps/web/buildspec.yml 의 post_build 와 동일하다.
# next.config.mjs 의 outputFileTracingRoot 가 '../../' 라 standalone 안에서
# 엔트리포인트가 apps/web/server.js 에 놓인다 (Procfile 과 같은 경로).
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

WORKDIR /app

COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
