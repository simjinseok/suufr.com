#!/usr/bin/env bash
# Coolify 배포가 끝날 때까지 폴링하고, 하나라도 실패하면 잡을 실패시킨다.
# 입력(env): COOLIFY_URL, COOLIFY_TOKEN(read 권한 필요), DEPLOYMENTS("api=<uuid> web=<uuid>", 값이 빈 항목은 무시)
#            POLL_INTERVAL(기본 15초). 전체 상한은 워크플로의 timeout-minutes 가 정한다.
# 상태값(Coolify ApplicationDeploymentStatus): queued | in_progress | finished | failed | cancelled-by-user
# (bash 3 호환: 연관 배열 대신 인덱스 배열을 나란히 쓴다)
set -euo pipefail

: "${COOLIFY_URL:?}" "${COOLIFY_TOKEN:?}" "${DEPLOYMENTS:?}"
interval="${POLL_INTERVAL:-15}"

names=() uuids=() results=() urls=()
for pair in $DEPLOYMENTS; do
  name="${pair%%=*}"; uuid="${pair#*=}"
  if [ -n "$uuid" ]; then
    names+=("$name"); uuids+=("$uuid"); results+=(""); urls+=("")
  fi
done
if [ "${#names[@]}" -eq 0 ]; then
  echo "nothing to wait for"; exit 0
fi

pending="${#names[@]}"
while [ "$pending" -gt 0 ]; do
  for i in "${!names[@]}"; do
    [ -z "${results[$i]}" ] || continue
    name="${names[$i]}"; uuid="${uuids[$i]}"
    if ! body=$(curl --fail-with-body -sS "$COOLIFY_URL/api/v1/deployments/$uuid" -H "Authorization: Bearer $COOLIFY_TOKEN"); then
      # 일시적 오류일 수 있으니 다음 주기에 다시 시도한다 (영구 오류는 timeout-minutes 가 끊는다)
      echo "$name: status query failed, retrying"
      continue
    fi
    status=$(jq -r '.status // empty' <<<"$body")
    echo "$name ($uuid): ${status:-unknown}"
    case "$status" in
      finished|failed|cancelled-by-user)
        results[i]="$status"
        urls[i]=$(jq -r '.deployment_url // empty' <<<"$body")
        pending=$((pending - 1))
        if [ "$status" != "finished" ]; then
          echo "::error::$name deployment $status ${urls[$i]}"
          # logs 는 토큰에 read:sensitive 가 있을 때만 내려온다 (JSON 문자열 안의 배열)
          jq -r '(.logs // "[]") | (fromjson? // []) | .[-40:][] | select(.hidden != true) | .output' <<<"$body" 2>/dev/null | sed "s/^/  [$name] /" || true
        fi
        ;;
    esac
  done
  [ "$pending" -gt 0 ] && sleep "$interval"
done

{
  echo "### Coolify deployments"
  echo
  echo "| app | status | link |"
  echo "|---|---|---|"
  for i in "${!names[@]}"; do
    echo "| ${names[$i]} | ${results[$i]} | ${urls[$i]} |"
  done
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"

for i in "${!names[@]}"; do
  [ "${results[$i]}" = "finished" ] || exit 1
done
echo "all deployments finished"
