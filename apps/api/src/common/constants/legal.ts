/**
 * 법적 문서 버전(시행일). apps/web/constants/legal.ts 와 값이 같아야 한다 (미러).
 * 사용자의 최신 동의 버전이 이 값과 다르면 /api/auth/me 가 consents.required = true 를 내려 재동의를 요구한다.
 */
export const TERMS_VERSION = '2026-07-08';
export const PRIVACY_POLICY_VERSION = '2026-07-08';
