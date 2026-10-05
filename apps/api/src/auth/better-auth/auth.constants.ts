/** better-auth 핸들러가 마운트되는 경로. 기존 NestJS AuthController(/api/auth/*)와 충돌하지 않게 분리한다. */
export const BETTER_AUTH_BASE_PATH = '/api/better-auth';

/** web 의 access_token 쿠키 수명과 같다 (Cognito access token 기본 1시간을 승계). */
export const JWT_TTL_SECONDS = 60 * 60;

/** refresh_token 쿠키(= better-auth 세션 토큰) 수명. Cognito refresh token 기본 30일을 승계. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;

export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 5 * 60;

export const BETTER_AUTH = Symbol('BETTER_AUTH');
