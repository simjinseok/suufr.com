#!/usr/bin/env bash
# Coolify 리소스의 이미지 태그를 불변 태그로 바꾸고 배포를 큐에 넣는다.
# 입력(env): COOLIFY_URL, COOLIFY_TOKEN, APP_UUID, IMAGE_TAG
# 출력: $GITHUB_OUTPUT 에 deployment_uuid (coolify-wait.sh 가 이 값으로 상태를 폴링한다)
set -euo pipefail

: "${COOLIFY_URL:?}" "${COOLIFY_TOKEN:?}" "${APP_UUID:?}" "${IMAGE_TAG:?}"

auth=(-H "Authorization: Bearer $COOLIFY_TOKEN")

# latest 태그 + deploy 웹훅만으로는 Coolify 가 새 이미지를 pull 하지 않을 수 있다(coolify#5318).
# 그래서 리소스의 이미지 태그를 불변 태그(sha-xxxxxxx)로 PATCH 한 뒤 배포를 트리거한다.
# PATCH 는 instant_deploy 를 주지 않으면 배포를 일으키지 않는다.
curl --fail-with-body -sS -X PATCH "$COOLIFY_URL/api/v1/applications/$APP_UUID" \
  "${auth[@]}" -H "Content-Type: application/json" \
  -d "{\"docker_registry_image_tag\":\"$IMAGE_TAG\"}" >/dev/null

# /deploy 는 POST (Coolify 4.2.0 부터 GET 은 405). 응답:
#   {"deployments":[{"message":"...","resource_uuid":"...","deployment_uuid":"..."}]}
# 같은 커밋의 배포가 이미 queued/in_progress 면 새로 만들지 않고 기존 deployment_uuid 를 돌려준다.
response=$(curl --fail-with-body -sS -X POST "$COOLIFY_URL/api/v1/deploy?uuid=$APP_UUID&force=false" "${auth[@]}")
echo "$response"

message=$(jq -r '.deployments[0].message // empty' <<<"$response")
deployment_uuid=$(jq -r '.deployments[0].deployment_uuid // empty' <<<"$response")

if [ -z "$deployment_uuid" ]; then
  echo "::error::Coolify did not return a deployment_uuid: ${message:-$response}"
  exit 1
fi
case "$message" in
  *"already queued"*) echo "::warning::$message (polling the existing deployment $deployment_uuid, which may run an older image tag)" ;;
esac

echo "deployment_uuid=$deployment_uuid" >> "$GITHUB_OUTPUT"
