import { createAuthMiddleware } from 'better-auth/api';
import { deleteSessionCookie } from 'better-auth/cookies';
import { generateRandomString } from 'better-auth/crypto';

/** twoFactor 플러그인이 쓰는 쿠키 이름(plugins/two-factor/constant) */
export const TWO_FACTOR_COOKIE_NAME = 'two_factor';
export const TWO_FACTOR_COOKIE_MAX_AGE = 600;

/**
 * 소셜 로그인(OAuth 콜백)에도 2단계 인증을 적용한다.
 *
 * better-auth 의 twoFactor 플러그인은 /sign-in/email 등 자격증명 로그인에만 챌린지를 걸고
 * /callback/:id(OAuth) 는 세션을 바로 발급한다. 이 훅은 플러그인의 after 훅과 같은 절차로
 * 방금 만든 세션을 지우고 two_factor 쿠키(검증 레코드 2fa-*)를 발급해, 이후 /two-factor/verify-totp ·
 * verify-backup-code 가 자격증명 로그인과 똑같이 동작하게 한다.
 */
export function createSocialTwoFactorHook() {
  return createAuthMiddleware(async (ctx) => {
    if (ctx.path !== '/callback/:id') return;

    const data = ctx.context.newSession;
    if (!data?.session || !data.user) return;
    if (!(data.user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled) return;

    // 2FA 미완료 상태에서는 세션이 존재하면 안 된다
    deleteSessionCookie(ctx, true);
    await ctx.context.internalAdapter.deleteSession(data.session.token);
    ctx.context.setNewSession(null);

    const twoFactorCookie = ctx.context.createAuthCookie(TWO_FACTOR_COOKIE_NAME, { maxAge: TWO_FACTOR_COOKIE_MAX_AGE });
    const identifier = `2fa-${generateRandomString(20)}`;
    const expiresAt = new Date(Date.now() + TWO_FACTOR_COOKIE_MAX_AGE * 1000);
    await ctx.context.internalAdapter.createVerificationValue({ value: data.user.id, identifier, expiresAt });
    await ctx.context.internalAdapter.createVerificationValue({ value: '0', identifier: `2fa-attempts-${identifier}`, expiresAt });
    await ctx.setSignedCookie(twoFactorCookie.name, identifier, ctx.context.secret, twoFactorCookie.attributes);
  });
}
