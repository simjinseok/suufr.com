import type { Event } from '@sentry/nestjs';
import { maskSharePath, scrubEvent, scrubSpan } from './sentry-scrub';

describe('maskSharePath', () => {
  it('공유 링크 경로의 shareId 를 가린다', () => {
    expect(maskSharePath('/api/student-shares/abcd1234')).toBe('/api/student-shares/[redacted]');
    expect(maskSharePath('http://localhost:5001/api/lessons/share/Ab3_x-9Z?x=1')).toBe(
      'http://localhost:5001/api/lessons/share/[redacted]?x=1',
    );
    expect(maskSharePath('https://suufr.com/sl/abcd1234')).toBe('https://suufr.com/sl/[redacted]');
  });

  it('라우트 이름과 다른 경로는 건드리지 않는다', () => {
    expect(maskSharePath('GET /api/student-shares/:shareId')).toBe('GET /api/student-shares/:shareId');
    expect(maskSharePath('/api/student-shares?studentUuid=abc')).toBe('/api/student-shares?studentUuid=abc');
    expect(maskSharePath('/api/students/abcd1234')).toBe('/api/students/abcd1234');
  });
});

describe('scrubEvent', () => {
  it('요청·트랜잭션·브레드크럼의 공유 링크 주소를 가린다', () => {
    const event = scrubEvent({
      transaction: 'GET /api/student-shares/abcd1234',
      request: { url: 'http://localhost:5001/api/student-shares/abcd1234', headers: { referer: 'https://suufr.com/sl/abcd1234' } },
      contexts: { trace: { trace_id: 't', span_id: 's', data: { 'url.full': 'http://localhost:5001/api/lessons/share/abcd1234' } } },
      breadcrumbs: [{ message: 'GET /api/student-shares/abcd1234', data: { url: '/api/student-shares/abcd1234' } }],
    } as Event);

    expect(event.transaction).toBe('GET /api/student-shares/[redacted]');
    expect(event.request?.url).toBe('http://localhost:5001/api/student-shares/[redacted]');
    expect(event.request?.headers?.referer).toBe('https://suufr.com/sl/[redacted]');
    expect(event.contexts?.trace?.data?.['url.full']).toBe('http://localhost:5001/api/lessons/share/[redacted]');
    expect(event.breadcrumbs?.[0].message).toBe('GET /api/student-shares/[redacted]');
    expect(event.breadcrumbs?.[0].data?.url).toBe('/api/student-shares/[redacted]');
  });

  it('다른 컨텍스트의 문자열 값도 가린다', () => {
    const event = scrubEvent({
      contexts: { request_info: { path: '/api/lessons/share/abcd1234', route: '/api/lessons/share/:shareId', count: 1 } },
    } as Event);
    expect(event.contexts?.request_info).toEqual({
      path: '/api/lessons/share/[redacted]',
      route: '/api/lessons/share/:shareId',
      count: 1,
    });
  });
});

describe('scrubSpan', () => {
  it('스팬 이름과 문자열 속성의 공유 링크 주소를 가린다', () => {
    const span = scrubSpan({
      name: 'GET /api/student-shares/:shareId',
      attributes: {
        'url.full': 'http://localhost:5001/api/student-shares/abcd1234',
        'http.request.header.referer': ['https://suufr.com/sl/abcd1234'],
        'http.status_code': 200,
      },
    });
    expect(span.name).toBe('GET /api/student-shares/:shareId');
    expect(span.attributes).toEqual({
      'url.full': 'http://localhost:5001/api/student-shares/[redacted]',
      'http.request.header.referer': ['https://suufr.com/sl/[redacted]'],
      'http.status_code': 200,
    });
  });
});
