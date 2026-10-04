# syntax=docker/dockerfile:1
# apps/api — NestJS(Fastify) + Prisma 7 이미지
# 빌드 컨텍스트는 모노레포 루트: docker build -f apps/api/Dockerfile .

ARG NODE_VERSION=24
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
# prisma generate → nest build (buildspec 과 동일 순서)
RUN pnpm --filter api prisma:generate \
 && pnpm --filter api build
# 런타임에 필요한 것만 한 디렉터리로 추출 — 포함 범위는 apps/api/package.json 의 "files" 가 결정한다
# (dist, prisma/, prisma.config.mjs + prod node_modules).
# prisma CLI 는 dependencies 에 있어 migrate deploy 를 컨테이너 안에서 실행할 수 있다.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter api deploy --prod --legacy /app/deploy

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

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>r.json()).then(b=>process.exit(b.status==='ok'?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
