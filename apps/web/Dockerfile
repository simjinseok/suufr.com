# syntax=docker/dockerfile:1
# apps/web — Next.js standalone 이미지
# 빌드 컨텍스트는 모노레포 루트: docker build -f apps/web/Dockerfile .

ARG NODE_VERSION=26
ARG PNPM_VERSION=11.17.0

# ---------- base ----------
FROM node:${NODE_VERSION}-bookworm-slim AS base
ARG PNPM_VERSION
ENV CI=true \
    NEXT_TELEMETRY_DISABLED=1 \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app

# ---------- deps ----------
# 매니페스트만 먼저 복사해 의존성 레이어 캐시를 최대한 재사용한다.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages ./packages
# hoisted 레이아웃 — Next standalone 추적이 이 레이아웃을 전제로 한다 (pnpm-workspace.yaml 주석 참고).
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter web... --config.node-linker=hoisted

# ---------- build ----------
FROM deps AS build
COPY . .

# NEXT_PUBLIC_* 는 빌드 타임에 번들에 인라인되므로 build-arg 로 넘겨야 한다.
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_CDN_URL
ARG NEXT_PUBLIC_SENTRY_DSN
# Sentry 소스맵 업로드용(선택). SENTRY_AUTH_TOKEN 은 secret mount 로만 전달해 레이어에 남기지 않는다.
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL} \
    NEXT_PUBLIC_CDN_URL=${NEXT_PUBLIC_CDN_URL} \
    NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN} \
    SENTRY_ORG=${SENTRY_ORG} \
    SENTRY_PROJECT=${SENTRY_PROJECT} \
    NODE_ENV=production

RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN,env=SENTRY_AUTH_TOKEN \
    pnpm --filter web build

# ---------- runner ----------
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# outputFileTracingRoot 가 모노레포 루트이므로 standalone 안에 apps/web/server.js 로 들어간다.
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public

USER node
EXPOSE 3000

# Coolify 는 이미지의 HEALTHCHECK 를 그대로 사용해 롤아웃을 판정한다(UI 설정으로 덮어쓸 수 없음).
# localhost 는 IPv6(::1)로 풀릴 수 있어 127.0.0.1 로 고정한다.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
