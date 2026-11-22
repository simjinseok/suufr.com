import { describe, expect, it } from 'vitest';
import type { Event } from '@sentry/nextjs';
import { maskSharePath, scrubEvent, scrubSpan } from './sentry.scrub';

describe('maskSharePath', () => {
  it('공유 링크 세 가지 경로의 shareId 를 가린다', () => {
    expect(maskSharePath('https://suufr.com/sl/Ab3_x-9Z?ref=1')).toBe('https://suufr.com/sl/[redacted]?ref=1');
    expect(maskSharePath('GET http://api:5001/api/student-shares/abcd1234')).toBe(
      'GET http://api:5001/api/student-shares/[redacted]',
    );
    expect(maskSharePath('/api/lessons/share/abcd1234')).toBe('/api/lessons/share/[redacted]');
  });

  it('라우트 이름과 다른 경로는 건드리지 않는다', () => {
    expect(maskSharePath('GET /sl/[shareId]')).toBe('GET /sl/[shareId]');
    expect(maskSharePath('GET /api/student-shares/:shareId')).toBe('GET /api/student-shares/:shareId');
    expect(maskSharePath('/api/student-shares?studentUuid=abc')).toBe('/api/student-shares?studentUuid=abc');
    expect(maskSharePath('/slides/abc')).toBe('/slides/abc');
  });
});

describe('scrubEvent', () => {
  it('서버 액션 폼 값·반환값 extra 를 지우고 다른 extra 는 남긴다', () => {
    const event = scrubEvent({
      extra: {
        'server_action_result': { totpURI: 'otpauth://secret' },
        'server_action_form_data.password': 'pw',
        'server_action_form_data.code': '123456',
        'other': 'keep',
      },
    } as Event);
    expect(event.extra).toEqual({ other: 'keep' });
  });

  it('요청·트랜잭션·스팬·브레드크럼의 공유 링크 주소를 가린다', () => {
    const event = scrubEvent({
      transaction: 'GET /sl/abcd1234',
      request: { url: 'https://suufr.com/sl/abcd1234', headers: { referer: 'https://suufr.com/sl/abcd1234' } },
      contexts: { trace: { trace_id: 't', span_id: 's', data: { 'url.full': 'https://suufr.com/sl/abcd1234' } } },
      spans: [
        {
          description: 'GET http://api/api/student-shares/abcd1234',
          data: { 'http.url': 'http://api/api/student-shares/abcd1234', 'count': 1 },
          span_id: 's',
          trace_id: 't',
          start_timestamp: 0,
        },
      ],
      breadcrumbs: [{ message: 'GET /api/lessons/share/abcd1234', data: { url: '/api/lessons/share/abcd1234' } }],
    } as unknown as Event); // 필요한 필드만 채운 테스트용 이벤트

    expect(event.transaction).toBe('GET /sl/[redacted]');
    expect(event.request?.url).toBe('https://suufr.com/sl/[redacted]');
    expect(event.request?.headers?.referer).toBe('https://suufr.com/sl/[redacted]');
    expect(event.contexts?.trace?.data?.['url.full']).toBe('https://suufr.com/sl/[redacted]');
    expect(event.spans?.[0].description).toBe('GET http://api/api/student-shares/[redacted]');
    expect(event.spans?.[0].data).toEqual({ 'http.url': 'http://api/api/student-shares/[redacted]', 'count': 1 });
    expect(event.breadcrumbs?.[0].message).toBe('GET /api/lessons/share/[redacted]');
    expect(event.breadcrumbs?.[0].data?.url).toBe('/api/lessons/share/[redacted]');
  });
});

describe('scrubSpan', () => {
  it('스팬 이름과 문자열 속성의 공유 링크 주소를 가린다', () => {
    const span = scrubSpan({
      name: 'GET /sl/abcd1234',
      attributes: { 'url.full': 'https://suufr.com/sl/abcd1234', 'http.target': '/sl/abcd1234', 'status': 200 },
    });
    expect(span.name).toBe('GET /sl/[redacted]');
    expect(span.attributes).toEqual({
      'url.full': 'https://suufr.com/sl/[redacted]',
      'http.target': '/sl/[redacted]',
      'status': 200,
    });
  });
});
