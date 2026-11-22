import type { Event } from '@sentry/nextjs';

// 공유 링크 주소의 shareId 는 열람 토큰이라 Sentry 로 보내지 않는다.
// 라우트 이름(/sl/[shareId], :shareId)은 글자 조건에 걸리지 않아 그대로 남는다.
const SHARE_PATH = /(\/(?:sl|api\/student-shares|api\/lessons\/share)\/)[A-Za-z0-9_-]+/g;

export function maskSharePath(value: string): string {
  return value.replace(SHARE_PATH, '$1[redacted]');
}

// 객체의 문자열 값만 골라 가린다 (헤더, 스팬 속성, 브레드크럼 data)
function maskStringValues(values: Record<string, unknown> | undefined) {
  if (!values) return;
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'string') values[key] = maskSharePath(value);
  }
}

// beforeSend 용: 오류 이벤트
export function scrubEvent<T extends Event>(event: T): T {
  // 서버 액션 계측이 남기는 폼 값·반환값. 액션에서 옵션을 뺐지만 한 번 더 막는다
  if (event.extra) {
    for (const key of Object.keys(event.extra)) {
      if (key === 'server_action_result' || key.startsWith('server_action_form_data.')) {
        delete event.extra[key];
      }
    }
  }

  if (event.request?.url) event.request.url = maskSharePath(event.request.url);
  maskStringValues(event.request?.headers);
  if (event.transaction) event.transaction = maskSharePath(event.transaction);
  maskStringValues(event.contexts?.trace?.data);

  for (const span of event.spans ?? []) {
    if (span.description) span.description = maskSharePath(span.description);
    maskStringValues(span.data);
  }

  for (const breadcrumb of event.breadcrumbs ?? []) {
    if (breadcrumb.message) breadcrumb.message = maskSharePath(breadcrumb.message);
    maskStringValues(breadcrumb.data);
  }

  return event;
}

// beforeSendSpan 용: Sentry 11 은 트랜잭션 대신 스팬을 하나씩 보낸다(beforeSendTransaction 은 호출되지 않음)
export function scrubSpan<T extends { name: string; attributes?: Record<string, unknown> }>(span: T): T {
  span.name = maskSharePath(span.name);
  maskStringValues(span.attributes);
  return span;
}
