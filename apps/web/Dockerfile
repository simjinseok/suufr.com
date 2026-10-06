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

# curl, wget: Coolify UI 헬스체크 명령이 `curl … || wget … || exit 1` 꼴이다. 둘 다 있어야 curl 실패 시
#   "wget: not found" 가 아니라 실제 HTTP 오류가 로그에 남고, 어느 쪽도 없으면 항상 unhealthy 로 판정돼 롤백된다.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl wget \
 && rm -rf /var/lib/apt/lists/*

# outputFileTracingRoot 가 모노레포 루트이므로 standalone 안에 apps/web/server.js 로 들어간다.
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public

USER node
EXPOSE 3000

# Coolify(Docker Image 빌드팩)는 이미지의 HEALTHCHECK 를 읽지 못한다. 롤아웃 판정은 Coolify UI 의 헬스체크 설정이
# compose 로 주입되어 이뤄지며, UI 헬스체크가 꺼져 있으면 기다리지 않고 컨테이너 기동만으로 성공 처리한다.
# 아래 HEALTHCHECK 는 로컬 docker run 과 UI 헬스체크를 끈 경우를 위한 것이고, UI 설정은 이 값과 같게 맞춘다
# (HTTP, host 127.0.0.1, port 3000, path /health, interval 30 / timeout 5 / retries 3 / start period 30).
# localhost 는 IPv6(::1)로 풀릴 수 있어 127.0.0.1 로 고정한다.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
