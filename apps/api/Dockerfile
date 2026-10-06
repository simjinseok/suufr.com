# syntax=docker/dockerfile:1
# apps/api — NestJS(Fastify) + Prisma 이미지
# 빌드 컨텍스트는 모노레포 루트: docker build -f apps/api/Dockerfile .

ARG NODE_VERSION=26
ARG PNPM_VERSION=11.17.0

# ---------- base ----------
FROM node:${NODE_VERSION}-bookworm-slim AS base
ARG PNPM_VERSION
ENV CI=true \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app

# ---------- deps ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages ./packages
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter api...

# ---------- build ----------
FROM deps AS build
COPY . .
RUN pnpm --filter api prisma:generate \
 && pnpm --filter api build
# 런타임에 필요한 것만 한 디렉터리로 추출 — 포함 범위는 apps/api/package.json 의 "files" 가 결정한다
# (dist, prisma/, prisma.config.mjs + prod node_modules).
# prisma CLI 는 dependencies 에 있어 migrate deploy 를 컨테이너 안에서 실행할 수 있다.
#
# --no-optional 이 필요한 이유:
#   better-auth 는 next / react / react-dom / vitest / mysql2 를 optional peer 로 선언하고,
#   pnpm 은 워크스페이스(web)에 있는 next 를 기준으로 이를 해석해 락파일에 optionalDependencies 로
#   기록한다. deploy 는 그걸 그대로 설치해 next·@next/swc·sharp·webpack·esbuild·babel 이
#   딸려 들어온다(실측 약 400MB). api 코드는 어느 것도 쓰지 않는다.
#   ignoredOptionalDependencies / overrides / dedupePeerDependents 는 deploy --legacy 에 효과가 없었다.
# ⚠️ 이 플래그는 진짜 optionalDependencies 도 건너뛴다. 운영에 필요한 네이티브 바이너리를
#    optional 로 두는 패키지를 새로 추가하면 조용히 빠질 수 있으니, 아래 검증 RUN 이 잡아주는
#    범위(prisma CLI, Prisma Client 로딩) 밖의 의존성은 직접 확인할 것.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter api deploy --prod --legacy --no-optional /app/deploy

# 운영에서 쓰지 않는 파일 제거 (실측 약 90MB).
#   - @electric-sql/pglite, elkjs: prisma CLI 체인(@prisma/dev, studio)에 딸려오지만 정적 require 되지 않는다.
#     (@prisma/studio-core, effect, @prisma/dev 는 cli.js 가 정적 require 하므로 지우면 크래시.)
#   - @prisma/client/runtime: postgresql 외 쿼리 컴파일러(mysql/sqlite/sqlserver/cockroachdb)와
#     small 변형, 소스맵. 생성된 클라이언트(dist/generated/prisma)는
#     query_compiler_fast_bg.postgresql.* 만 require 한다.
# ⚠️ 반드시 runner 의 COPY 전에, 이 스테이지 안에서 지워야 이미지가 줄어든다. COPY 뒤에 지우면
#    하위 레이어에 파일이 남아 컨테이너 안 du 만 작아 보인다.
# ⚠️ prisma 내부 구조에 의존하므로 버전이 오르면 깨질 수 있다. 같은 RUN 에서 CLI·Client 로딩을
#    검증해 빌드 단계에서 드러나게 한다. 이 검증 줄을 지우지 말 것.
RUN cd /app/deploy \
 && rm -rf node_modules/.pnpm/@electric-sql+pglite@* node_modules/.pnpm/elkjs@* \
 && RT=$(ls -d node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/runtime) \
 && rm -f "$RT"/query_compiler_*bg.mysql.* "$RT"/query_compiler_*bg.sqlite.* \
          "$RT"/query_compiler_*bg.sqlserver.* "$RT"/query_compiler_*bg.cockroachdb.* \
          "$RT"/query_compiler_small_bg.postgresql.* "$RT"/*.map \
 && test -f "$RT"/query_compiler_fast_bg.postgresql.js \
 && test -f "$RT"/query_compiler_fast_bg.postgresql.wasm-base64.js \
 && echo "--- prune 후 로딩 검증 ---" \
 && node_modules/.bin/prisma --version \
 && node -e "require('./dist/generated/prisma/client'); require('@prisma/adapter-pg')" \
 && echo "--- 검증 통과 ---" \
 && du -sh node_modules

# ---------- runner ----------
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=5001

# Prisma schema engine(migrate) 이 openssl 을 필요로 한다.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=node:node /app/deploy ./
COPY --chown=node:node apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER node
EXPOSE 5001

# Coolify 는 이미지의 HEALTHCHECK 를 그대로 사용해 롤아웃을 판정한다(UI 설정으로 덮어쓸 수 없음).
# - 프로세스 생존만 본다(GET /). /health 는 DB 연결까지 확인하므로 DB 장애 시 배포 실패·재시작 루프를
#   만들 수 있어 외부 모니터링용으로만 쓴다.
# - entrypoint 가 마이그레이션을 먼저 돌리므로 start-period 를 넉넉히 둔다.
# - localhost 는 IPv6(::1)로 풀릴 수 있어 127.0.0.1 로 고정한다.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
