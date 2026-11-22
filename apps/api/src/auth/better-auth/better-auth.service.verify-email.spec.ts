import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import type { PrismaClient } from '@prisma/generated/client';
import type { MailMessage, MailService } from '../../mail/mail.service';
import { verifyEmailMail } from '../../mail/templates/auth-mails';
import { createAuthOptions } from './auth.config';
import { BetterAuthService, type IssuedTokens } from './better-auth.service';

type SessionRow = { token: string; userId: string; ipAddress?: string; userAgent?: string };

const EMAIL = 'owner@example.com';
const PASSWORD = 'Passw0rd!x';

/**
 * 운영 옵션(createAuthOptions)에서 DB 만 메모리 어댑터로 바꾼 실제 better-auth 인스턴스로 이메일 인증을 검증한다.
 * - 인증(=소유권 증명) 시점에 그 전에 생긴 세션을 폐기한다 (인증을 요청한 세션만 남긴다).
 * - 미인증이던 계정이면 바로 로그인 토큰을 준다. 이미 인증된 계정·2단계 인증 계정은 토큰을 주지 않는다.
 */
function makeAuth() {
  const db: Record<string, unknown[]> = { user: [], authSession: [], account: [], verification: [], jwks: [], twoFactor: [] };
  // 마지막으로 보낸 인증코드 (메일 본문에서 꺼낸다)
  const otps = new Map<string, string>();
  const sendOrThrow = vi.fn(async (message: MailMessage) => {
    const code = message.text.match(/\b\d{6}\b/)?.[0];
    if (code && message.subject === verifyEmailMail(message.to, code).subject) otps.set(message.to, code);
  });
  const options = createAuthOptions({
    prisma: {} as PrismaClient,
    baseURL: 'https://api.test',
    secret: 'test-secret-test-secret-test-secret-test',
    webUrl: 'https://web.test',
    mail: { send: vi.fn(), sendOrThrow } as unknown as MailService,
    onUserCreated: vi.fn(),
  });
  const auth = betterAuth({ ...options, database: memoryAdapter(db) });
  return { auth, db, otps, service: new BetterAuthService(auth as never) };
}

type Ctx = ReturnType<typeof makeAuth>;

/** 가입 후 세션을 n개 만든다. 이전 정책(가입 즉시 로그인)에서 남은 세션이나 Google 로그인 세션을 흉내 낸다 */
async function signUpWithSessions({ auth, service }: Ctx, email: string, sessions: number) {
  const { userId } = await service.signUp('선생님', email, PASSWORD);
  const { internalAdapter } = await auth.$context;
  const tokens: string[] = [];
  for (let i = 0; i < sessions; i++) {
    const session = await internalAdapter.createSession(userId);
    tokens.push(session.token);
  }
  return { userId, tokens };
}

function liveTokens(db: Record<string, unknown[]>, userId: string): string[] {
  return (db.authSession as SessionRow[]).filter(s => s.userId === userId).map(s => s.token);
}

function userRow(db: Record<string, unknown[]>, email: string) {
  return (db.user as { email: string; emailVerified: boolean; twoFactorEnabled?: boolean }[]).find(u => u.email === email)!;
}

describe('BetterAuthService.verifyEmail — 인증 시 미증명 세션 폐기', () => {
  it('인증을 요청한 세션 토큰이 그 사용자의 것이면 그 세션만 남기고 나머지를 폐기한다', async () => {
    const ctx = makeAuth();
    const { userId, tokens: [attackerSession, ownerSession] } = await signUpWithSessions(ctx, EMAIL, 2);
    expect(liveTokens(ctx.db, userId)).toHaveLength(2);

    await ctx.service.verifyEmail(EMAIL, ctx.otps.get(EMAIL)!, ownerSession);

    // 남긴 세션 + 인증 즉시 로그인으로 새로 만든 세션
    expect(liveTokens(ctx.db, userId)).toContain(ownerSession);
    expect(liveTokens(ctx.db, userId)).not.toContain(attackerSession);
    expect(userRow(ctx.db, EMAIL).emailVerified).toBe(true);
  });

  it('세션 토큰 없이 인증하면 그 사용자의 이전 세션을 전부 폐기한다', async () => {
    const ctx = makeAuth();
    const { userId } = await signUpWithSessions(ctx, EMAIL, 2);

    const issued = await ctx.service.verifyEmail(EMAIL, ctx.otps.get(EMAIL)!);

    // 남는 것은 인증 즉시 로그인으로 새로 만든 세션 하나뿐
    expect(liveTokens(ctx.db, userId)).toEqual([issued!.refreshToken]);
  });

  it('세션 토큰이 다른 사용자의 것이면 인증된 사용자의 이전 세션을 전부 폐기하고 그 다른 사용자의 세션은 건드리지 않는다', async () => {
    const ctx = makeAuth();
    const owner = await signUpWithSessions(ctx, EMAIL, 2);
    const other = await signUpWithSessions(ctx, 'other@example.com', 1);

    const issued = await ctx.service.verifyEmail(EMAIL, ctx.otps.get(EMAIL)!, other.tokens[0]);

    expect(liveTokens(ctx.db, owner.userId)).toEqual([issued!.refreshToken]);
    expect(liveTokens(ctx.db, other.userId)).toEqual(other.tokens);
  });

  it('만료·폐기된 세션 토큰을 주면 토큰 없는 경우와 같이 이전 세션을 전부 폐기한다', async () => {
    const ctx = makeAuth();
    const { userId } = await signUpWithSessions(ctx, EMAIL, 2);

    const issued = await ctx.service.verifyEmail(EMAIL, ctx.otps.get(EMAIL)!, 'not-a-real-session-token');

    expect(liveTokens(ctx.db, userId)).toEqual([issued!.refreshToken]);
  });

  it('OTP 가 틀리면 세션을 건드리지 않고 토큰도 주지 않는다', async () => {
    const ctx = makeAuth();
    const { userId, tokens } = await signUpWithSessions(ctx, EMAIL, 2);

    await expect(ctx.service.verifyEmail(EMAIL, '000000', tokens[1])).rejects.toThrow();

    expect(liveTokens(ctx.db, userId)).toEqual(tokens);
    expect(userRow(ctx.db, EMAIL).emailVerified).toBe(false);
  });
});

describe('BetterAuthService.verifyEmail — 인증 즉시 로그인', () => {
  it('미인증이던 계정이면 세션을 새로 만들어 토큰을 주고(요청 IP·UA 기록), 그 토큰으로 refresh 된다', async () => {
    const ctx = makeAuth();
    const { userId } = await ctx.service.signUp('선생님', EMAIL, PASSWORD);

    const issued = await ctx.service.verifyEmail(EMAIL, ctx.otps.get(EMAIL)!, undefined, { ip: '10.0.0.1', userAgent: 'Suufr iOS' });

    expect(issued).toMatchObject({ success: true, userId, expiresIn: 3600 });
    expect(issued!.accessToken.split('.')).toHaveLength(3);
    const session = (ctx.db.authSession as SessionRow[]).find(s => s.token === issued!.refreshToken)!;
    expect(session).toMatchObject({ userId, ipAddress: '10.0.0.1', userAgent: 'Suufr iOS' });
    await expect(ctx.service.refresh(issued!.refreshToken)).resolves.toMatchObject({ success: true });
  });

  it('이미 인증된 계정은 인증코드가 맞아도 토큰을 주지 않는다 (메일 코드만으로 비밀번호 로그인을 건너뛰지 못하게)', async () => {
    const ctx = makeAuth();
    const { userId } = await ctx.service.signUp('선생님', EMAIL, PASSWORD);
    userRow(ctx.db, EMAIL).emailVerified = true;
    // 인증된 사용자에게도 재발송은 코드를 보낸다
    await ctx.service.resendVerification(EMAIL);

    await expect(ctx.service.verifyEmail(EMAIL, ctx.otps.get(EMAIL)!)).resolves.toBeNull();

    expect(liveTokens(ctx.db, userId)).toHaveLength(0);
  });

  it('2단계 인증을 켠 미인증 계정은 토큰을 주지 않는다 (인증 후 비밀번호 로그인에서 2단계 인증을 거친다)', async () => {
    const ctx = makeAuth();
    const { userId } = await ctx.service.signUp('선생님', EMAIL, PASSWORD);
    userRow(ctx.db, EMAIL).twoFactorEnabled = true;

    await expect(ctx.service.verifyEmail(EMAIL, ctx.otps.get(EMAIL)!)).resolves.toBeNull();

    expect(liveTokens(ctx.db, userId)).toHaveLength(0);
    expect(userRow(ctx.db, EMAIL).emailVerified).toBe(true);
    await expect(ctx.service.signIn(EMAIL, PASSWORD)).resolves.toMatchObject({ requiresMfa: true });
  });

  it('인증 뒤에는 비밀번호 로그인이 된다', async () => {
    const ctx = makeAuth();
    const { userId } = await ctx.service.signUp('선생님', EMAIL, PASSWORD);
    await ctx.service.verifyEmail(EMAIL, ctx.otps.get(EMAIL)!);

    const signedIn = await ctx.service.signIn(EMAIL, PASSWORD) as IssuedTokens;

    expect(signedIn).toMatchObject({ success: true, userId });
  });
});
