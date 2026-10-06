import 'server-only';
import { cookies } from 'next/headers';

// refresh_token(= better-auth 세션 토큰) 쿠키 수명. api 의 세션 수명(30일)과 같다
export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30;
// 2단계 인증 챌린지(two_factor 쿠키 쌍) 보관 시간
export const MFA_SESSION_MAX_AGE = 300;

/**
 * 로그인 성공 시 토큰 쿠키 세팅 (비밀번호·2FA·소셜 로그인 공용).
 * access_token = better-auth JWT(1시간), refresh_token = better-auth 세션 토큰(30일).
 * 서버 액션과 라우트 핸들러에서만 호출할 수 있다.
 */
export async function setTokenCookies(response: {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}) {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === 'production';

  cookieStore.set('access_token', response.accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: (response.expiresIn || 3600) - 60,
  });

  cookieStore.set('refresh_token', response.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

/** 2단계 인증 챌린지 보관 — 로그인 응답의 session(two_factor 쿠키 쌍)을 5분간 보관한다 */
export async function setMfaSessionCookie(session: string) {
  const cookieStore = await cookies();
  cookieStore.set('mfa_session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: MFA_SESSION_MAX_AGE,
  });
}
