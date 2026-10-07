/**
 * Google 가입의 동의값을 OAuth 왕복 동안 보관하는 api 도메인 쿠키.
 *
 * web 가입 폼은 동의 체크 뒤 브라우저를 api /auth/google/start 로 보내는데, 사용자 행은 그 뒤 Google 콜백에서 만들어진다.
 * 그래서 start 가 동의값을 쿠키로 심고, 콜백 뒤 브라우저가 돌아오는 /auth/social/google/complete 가 읽어 이력을 기록한다.
 * better-auth 의 state 쿠키와 같은 원리(브라우저가 api 도메인에 직접 오므로 쿠키가 살아 돌아온다).
 * 값은 사용자가 본 문서 버전뿐이다 — 위조해도 본인 동의 이력에 다른 버전이 적힐 뿐이라 서명하지 않는다.
 */
export const SOCIAL_CONSENT_COOKIE = 'suufr.social_consent';
/** 신규 가입자 콜백(complete?new=1)을 구분하는 쿼리 키. start 가 better-auth newUserCallbackURL 에 붙인다 */
export const NEW_USER_QUERY_KEY = 'new';
const COOKIE_PATH = '/auth/social';
const MAX_AGE_SECONDS = 15 * 60;
const DOC_VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type SocialConsent = { termsVersion: string; privacyVersion: string };

/** start 의 쿼리 → 동의값. 두 동의가 모두 true 이고 버전 형식이 맞을 때만 값, 아니면 null */
export function parseSocialConsentQuery(query: Record<string, unknown>): SocialConsent | null {
  const { terms, privacy, termsVersion, privacyVersion } = query;
  if (terms !== 'true' || privacy !== 'true') return null;
  if (typeof termsVersion !== 'string' || !DOC_VERSION_PATTERN.test(termsVersion)) return null;
  if (typeof privacyVersion !== 'string' || !DOC_VERSION_PATTERN.test(privacyVersion)) return null;
  return { termsVersion, privacyVersion };
}

export function buildSocialConsentCookie(consent: SocialConsent, secure: boolean): string {
  const value = `${consent.termsVersion}|${consent.privacyVersion}`;
  return `${SOCIAL_CONSENT_COOKIE}=${value}; Max-Age=${MAX_AGE_SECONDS}; Path=${COOKIE_PATH}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export function expireSocialConsentCookie(secure: boolean): string {
  return `${SOCIAL_CONSENT_COOKIE}=; Max-Age=0; Path=${COOKIE_PATH}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/** cookie 헤더에서 동의값을 읽는다. 없거나 형식이 깨졌으면 null */
export function readSocialConsentCookie(cookieHeader: string | undefined): SocialConsent | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0 || part.slice(0, idx).trim() !== SOCIAL_CONSENT_COOKIE) continue;
    const [termsVersion, privacyVersion] = part.slice(idx + 1).trim().split('|');
    return parseSocialConsentQuery({ terms: 'true', privacy: 'true', termsVersion, privacyVersion });
  }
  return null;
}
