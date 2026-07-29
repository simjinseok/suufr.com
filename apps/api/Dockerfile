# syntax=docker/dockerfile:1
#
# apps/api — NestJS(Fastify) + Prisma 7
#
# 빌드 컨텍스트는 모노레포 루트다:
#   docker build -f apps/api/Dockerfile -t suufr-api .
#
# alpine 이 아니라 slim(debian) 을 쓰는 이유:
#   런타임 Prisma Client 는 driver adapter 방식이라 엔진 바이너리가 필요 없지만,
#   entrypoint 에서 돌리는 `prisma migrate deploy` 의 CLI 가 @prisma/engines 를
#   prod 의존성으로 끌고 오고, 그 postinstall 이 네이티브 schema-engine 을
#   내려받는다. glibc + openssl 이 필요하다.

ARG NODE_VERSION=24-slim

# ---------------------------------------------------------------------------
# base — pnpm 활성화
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS base

# CI=true: TTY 없는 환경에서 pnpm 의 빌드 스크립트 승인 프롬프트로 멈추지 않게
ENV CI=true \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11 --activate

WORKDIR /app

# ---------------------------------------------------------------------------
# manifests — 매니페스트만 모아 install 레이어 캐시를 살린다
#
# `COPY apps/*/package.json` 같은 와일드카드는 Docker 가 경로를 평탄화해서
# 서로 덮어쓴다. 반드시 디렉터리별로 명시할 것.
# 또 --frozen-lockfile 은 워크스페이스 전체를 락파일과 대조하므로,
# api 만 빌드하더라도 web/packages 의 package.json 이 모두 있어야 한다.
# ---------------------------------------------------------------------------
FROM base AS manifests

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/

# ---------------------------------------------------------------------------
# deps — 빌드용 전체 설치 (devDependencies 포함: nest cli, typescript, turbo)
# ---------------------------------------------------------------------------
FROM manifests AS deps

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# build — prisma generate 후 nest build
#
# 순서가 중요하다. generator output 이 apps/api/src/generated/prisma (TS) 라
# generate 가 먼저 돌아야 nest build 가 dist/generated/prisma 로 함께
# 컴파일한다. tsconfig 의 @prisma/generated/* alias 는 emit 시 상대경로로
# 치환되므로 런타임에 별도 alias 리졸버가 필요 없다.
# ---------------------------------------------------------------------------
FROM deps AS build

COPY . .

RUN pnpm --filter=api prisma:generate \
  && pnpm turbo build --filter=api

# ---------------------------------------------------------------------------
# prod-deps — 런타임 의존성만.
#
# ⚠️ 여기서 --config.node-linker=hoisted 를 쓰면 안 된다. hoisted 는 락파일
#    전체를 기준으로 호이스팅을 계산해서 --filter 를 무시하고 워크스페이스
#    전체를 설치한다. 실측상 api 이미지에 next / @heroui / lucide-react 같은
#    web 전용 의존성이 들어와 node_modules 가 1.3G 로 불어났다.
#    기본(isolated) 링커 + --filter 조합은 538M 로 떨어지고 next 도 없다.
#    hoisted 가 필요한 쪽은 web 뿐이다 (Next 의 file tracing 때문).
#
# isolated 레이아웃이라 실제 패키지는 /app/node_modules/.pnpm 아래에 있고
# /app/apps/api/node_modules 는 거기로 향하는 상대 심볼릭 링크다.
# 런타임 스테이지에서 반드시 두 디렉터리를 같은 상대 위치로 함께 복사할 것.
#
# `prisma` 는 devDependency 가 아니라 dependency 다 (entrypoint 가 의존).
# 그 대가로 @prisma/studio-core / mysql2 / postgres 가 딸려온다.
# ---------------------------------------------------------------------------
FROM manifests AS prod-deps

# ⚠️ `--filter=api` 이지 `--filter=api...` 가 아니다. `...` 는 워크스페이스
#    의존성 그래프를 함께 포함하는데, 이 그래프 탐색은 devDependency 도 따라간다.
#    api 의 devDependency 인 @suufr/eslint-config 가 끌려 들어오면서 그 패키지의
#    prod 의존성인 eslint / @typescript-eslint / @stylistic 이 이미지에 실렸다.
#    api 의 dependencies 에는 워크스페이스 패키지가 없으므로 `...` 는 불필요하다.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter=api

# prisma CLI 부속 중 운영에서 안 쓰는 것 제거 (약 54MB)
#
# prisma CLI 는 entrypoint 의 `migrate deploy` 때문에 dependency 로 들어와야
# 하는데, 단일 번들이라 로드 시점에 Studio/dev 모듈을 정적으로 require 한다.
# 실측 결과:
#   @prisma/studio-core (43M) → 삭제 시 크래시 (cli.js 가 정적 require)
#   effect              (33M) → 삭제 시 크래시 (@prisma/config 가 사용)
#   @prisma/dev         (19M) → 삭제 시 크래시 (cli.js 가 정적 require)
#   pglite/typescript/elkjs   → 삭제 가능. 여기서 제거한다.
#
# ⚠️ 이 삭제는 반드시 **prod-deps 스테이지 안에서** 해야 한다. runner 의
#    COPY 뒤에서 지우면 파일이 하위 레이어에 그대로 남아 이미지 크기가 전혀
#    줄지 않는다 (컨테이너 안 du 만 작아 보인다). COPY --from= 은 스테이지의
#    최종 파일시스템을 가져오므로 여기서 지워야 실제로 반영된다.
#
# 이 rm 은 prisma 내부 구조에 의존하므로, 버전이 올라가면서 위 세 패키지를
# 정적 require 하게 되면 깨진다. 그 사고가 운영에서 터지지 않도록 같은
# 레이어에서 CLI 로딩을 검증한다. 실패하면 이미지 빌드가 죽으므로 CodeBuild
# 단계에서 즉시 드러난다. 이 검증 줄을 지우지 말 것.
RUN rm -rf /app/node_modules/.pnpm/@electric-sql+pglite@* \
           /app/node_modules/.pnpm/typescript@* \
           /app/node_modules/.pnpm/elkjs@* \
  && echo "--- prune 후 prisma CLI 로딩 검증 ---" \
  && /app/apps/api/node_modules/.bin/prisma --version \
  && echo "--- 검증 통과 ---"

# ---------------------------------------------------------------------------
# runner
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=5001 \
    PATH=/app/node_modules/.bin:/app/apps/api/node_modules/.bin:$PATH

WORKDIR /app

# isolated 레이아웃이므로 루트(.pnpm 실체)와 앱(심볼릭 링크) 양쪽이 모두 필요하다.
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /app/apps/api/prisma.config.mjs ./apps/api/
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/
COPY --chown=node:node apps/api/docker-entrypoint.sh /app/docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh

# prisma.config.mjs 의 schema 경로가 'prisma/schema.prisma' 상대경로라
# cwd 가 apps/api 여야 migrate 가 스키마를 찾는다.
WORKDIR /app/apps/api

# 최종 레이아웃에서 앱이 Prisma Client 를 실제로 로드할 수 있는지 확인한다.
# (prune 자체는 prod-deps 스테이지에서 끝났다 — 레이어 크기 때문)
RUN node -e "require('/app/apps/api/dist/generated/prisma/client'); require('@prisma/adapter-pg')" \
  && echo "--- Prisma Client 로딩 검증 통과 ---"

USER node

EXPOSE 5001

# /health 는 @Public 이고 SELECT 1 로 DB 연결까지 확인한다.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5001)+'/health').then(r=>r.json()).then(j=>process.exit(j.database==='connected'?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/main"]
