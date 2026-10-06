/** better-auth basePath. HTTP 핸들러는 마운트하지 않지만 기존 AuthController(/api/auth/*)와 겹치지 않는 값으로 둔다. */
export const BETTER_AUTH_BASE_PATH = '/api/better-auth';

/** web 의 access_token 쿠키 수명과 같다 (1시간). */
export const JWT_TTL_SECONDS = 60 * 60;

/** refresh_token 쿠키(= better-auth 세션 토큰) 수명 (30일). */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;

export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 5 * 60;

export const BETTER_AUTH = Symbol('BETTER_AUTH');
