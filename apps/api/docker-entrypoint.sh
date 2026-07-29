#!/bin/sh
# apps/api 컨테이너 entrypoint.
#
# EB 시절의 .platform/hooks/predeploy/01_prisma_migrate.sh 를 대체한다.
# 차이점:
#   - npx 대신 PATH 의 prisma 를 직접 쓴다. npx 는 패키지를 못 찾으면
#     레지스트리로 나가버리는데, 운영 컨테이너에서 그런 일이 생기면 안 된다.
#   - RUN_MIGRATIONS=false 로 끌 수 있다. 마이그레이션 없이 재기동만 하거나,
#     나중에 마이그레이션을 별도 잡으로 분리할 때 이미지 변경 없이 대응한다.
#
# set -e 이므로 마이그레이션이 실패하면 컨테이너가 뜨지 않는다.
# 반쯤 마이그레이션된 스키마 위에 서비스가 붙는 것보다 낫다.
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  if ! command -v prisma > /dev/null 2>&1; then
    echo "[entrypoint] prisma CLI를 찾을 수 없습니다. PATH=$PATH" >&2
    exit 1
  fi

  if [ -z "${POSTGRES_PRISMA_URL}" ]; then
    echo "[entrypoint] POSTGRES_PRISMA_URL 이 설정되지 않았습니다." >&2
    exit 1
  fi

  echo "[entrypoint] prisma migrate deploy 실행..."
  prisma migrate deploy
  echo "[entrypoint] 마이그레이션 완료"
else
  echo "[entrypoint] RUN_MIGRATIONS=false — 마이그레이션 건너뜀"
fi

exec "$@"
