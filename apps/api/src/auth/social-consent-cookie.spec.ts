import {
  buildSocialConsentCookie,
  expireSocialConsentCookie,
  parseSocialConsentQuery,
  readSocialConsentCookie,
} from './social-consent-cookie';

describe('parseSocialConsentQuery', () => {
  const valid = { terms: 'true', privacy: 'true', termsVersion: '2026-07-08', privacyVersion: '2026-07-08' };

  it('두 동의가 true 이고 버전 형식이 맞으면 값을 돌려준다', () => {
    expect(parseSocialConsentQuery(valid)).toEqual({ termsVersion: '2026-07-08', privacyVersion: '2026-07-08' });
  });

  it('하나라도 동의하지 않았거나 버전이 깨졌으면 null', () => {
    expect(parseSocialConsentQuery({ ...valid, privacy: 'false' })).toBeNull();
    expect(parseSocialConsentQuery({ ...valid, terms: undefined })).toBeNull();
    expect(parseSocialConsentQuery({ ...valid, termsVersion: '20260708' })).toBeNull();
    expect(parseSocialConsentQuery({ ...valid, privacyVersion: ['2026-07-08'] })).toBeNull();
  });
});

describe('social consent cookie', () => {
  const consent = { termsVersion: '2026-07-08', privacyVersion: '2026-07-01' };

  it('심은 쿠키를 cookie 헤더에서 다시 읽는다', () => {
    const line = buildSocialConsentCookie(consent, true);
    expect(line).toContain('HttpOnly');
    expect(line).toContain('Secure');
    expect(line).toContain('Path=/auth/social');
    const pair = line.split(';')[0];
    expect(readSocialConsentCookie(`other=1; ${pair}; x=y`)).toEqual(consent);
  });

  it('쿠키가 없거나 값이 깨졌으면 null', () => {
    expect(readSocialConsentCookie(undefined)).toBeNull();
    expect(readSocialConsentCookie('other=1')).toBeNull();
    expect(readSocialConsentCookie('suufr.social_consent=garbage')).toBeNull();
  });

  it('만료 쿠키는 같은 경로로 Max-Age=0', () => {
    expect(expireSocialConsentCookie(false)).toBe('suufr.social_consent=; Max-Age=0; Path=/auth/social; HttpOnly; SameSite=Lax');
  });
});
