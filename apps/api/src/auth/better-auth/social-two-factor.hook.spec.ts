import { createSocialTwoFactorHook, TWO_FACTOR_COOKIE_NAME } from './social-two-factor.hook';

/** 훅 미들웨어를 직접 호출하기 위한 최소 ctx. better-auth 가 넘기는 모양을 흉내 낸다 */
function makeCtx(path: string, newSession: unknown) {
  const internalAdapter = {
    deleteSession: vi.fn().mockResolvedValue(undefined),
    createVerificationValue: vi.fn().mockResolvedValue(undefined),
  };
  const context = {
    newSession,
    internalAdapter,
    secret: 's3cret',
    setNewSession: vi.fn(),
    createAuthCookie: vi.fn((name: string, opts?: { maxAge?: number }) => ({ name: `better-auth.${name}`, attributes: { maxAge: opts?.maxAge, httpOnly: true, path: '/' } })),
    authCookies: {
      sessionToken: { name: 'better-auth.session_token', attributes: {} },
      sessionData: { name: 'better-auth.session_data', attributes: {} },
      dontRememberToken: { name: 'better-auth.dont_remember', attributes: {} },
      accountData: { name: 'better-auth.account_data', attributes: {} },
    },
    oauthConfig: { storeStateStrategy: 'database' },
    responseHeaders: new Headers(),
    options: { account: {} },
  };
  const ctx = {
    path,
    // dispatch 가 훅을 호출할 때와 같이 응답 헤더를 반환받는다
    returnHeaders: true,
    context,
    setCookie: vi.fn(),
    setSignedCookie: vi.fn().mockResolvedValue(undefined),
    getCookie: vi.fn(),
    headers: new Headers(),
    responseHeaders: context.responseHeaders,
  };
  return { ctx, context, internalAdapter };
}

async function run(ctx: unknown): Promise<{ headers?: Headers } | undefined> {
  const hook = createSocialTwoFactorHook() as unknown as (c: unknown) => Promise<{ headers?: Headers } | undefined>;
  return hook(ctx);
}

describe('createSocialTwoFactorHook', () => {
  it('OAuth 콜백이 아니면 아무것도 하지 않는다', async () => {
    const { ctx, internalAdapter } = makeCtx('/sign-in/email', { session: { token: 't' }, user: { id: 'u', twoFactorEnabled: true } });
    await run(ctx);
    expect(internalAdapter.deleteSession).not.toHaveBeenCalled();
  });

  it('2FA 미사용 사용자의 콜백은 세션을 유지한다', async () => {
    const { ctx, internalAdapter, context } = makeCtx('/callback/:id', { session: { token: 't' }, user: { id: 'u', twoFactorEnabled: false } });
    await run(ctx);
    expect(internalAdapter.deleteSession).not.toHaveBeenCalled();
    expect(context.setNewSession).not.toHaveBeenCalled();
  });

  it('2FA 사용자의 콜백은 세션을 지우고 two_factor 챌린지 쿠키·검증 레코드를 만든다', async () => {
    const { ctx, internalAdapter, context } = makeCtx('/callback/:id', { session: { token: 'sess-token' }, user: { id: 'user-1', twoFactorEnabled: true } });
    const result = await run(ctx);

    expect(internalAdapter.deleteSession).toHaveBeenCalledWith('sess-token');
    expect(context.setNewSession).toHaveBeenCalledWith(null);

    const calls = internalAdapter.createVerificationValue.mock.calls.map(c => c[0] as { identifier: string; value: string });
    const challenge = calls.find(c => c.identifier.startsWith('2fa-') && !c.identifier.startsWith('2fa-attempts-'));
    expect(challenge?.value).toBe('user-1');
    expect(calls.some(c => c.identifier === `2fa-attempts-${challenge!.identifier}` && c.value === '0')).toBe(true);

    // createAuthMiddleware 가 만드는 실제 ctx 의 setSignedCookie 는 반환되는 headers 에 set-cookie 를 쌓는다
    const setCookies = result?.headers?.getSetCookie() ?? [];
    const twoFactor = setCookies.find(line => line.startsWith(`better-auth.${TWO_FACTOR_COOKIE_NAME}=`));
    expect(twoFactor).toBeDefined();
    expect(twoFactor).toContain(challenge!.identifier);
    expect(twoFactor).toContain('HttpOnly');
    // 세션 쿠키는 삭제(Max-Age=0) 지시가 나간다
    expect(setCookies.some(line => line.startsWith('better-auth.session_token=') && /max-age=0/i.test(line))).toBe(true);
  });
});
