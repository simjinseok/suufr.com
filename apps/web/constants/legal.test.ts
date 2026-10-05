import { describe, expect, it } from 'vitest';
import * as web from './legal';
import * as api from '../../api/src/common/constants/legal';

// web/api 상수는 미러다. 어긋나면 가입은 막히지 않지만 모든 사용자에게 재동의 모달이 뜬다.
describe('법적 문서 버전 상수 미러', () => {
  it('web 과 api 의 TERMS_VERSION 이 같다', () => {
    expect(web.TERMS_VERSION).toBe(api.TERMS_VERSION);
  });

  it('web 과 api 의 PRIVACY_POLICY_VERSION 이 같다', () => {
    expect(web.PRIVACY_POLICY_VERSION).toBe(api.PRIVACY_POLICY_VERSION);
  });

  it('버전은 YYYY-MM-DD 형식이다', () => {
    expect(web.TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(web.PRIVACY_POLICY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('formatLegalDate 는 한국어 날짜로 바꾼다', () => {
    expect(web.formatLegalDate('2026-07-08')).toBe('2026년 7월 8일');
  });
});
