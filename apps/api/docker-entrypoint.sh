#!/bin/sh
# 컨테이너 시작 시 Prisma 마이그레이션을 적용한 뒤 앱을 실행한다.
# 레플리카를 여러 개 띄우거나 마이그레이션을 별도 단계로 돌릴 때는 SKIP_MIGRATIONS=true 로 끈다.
set -e

if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
  echo "[entrypoint] Running prisma migrate deploy..."
  ./node_modules/.bin/prisma migrate deploy
  echo "[entrypoint] Prisma migrations completed"
fi

exec "$@"
