import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { bearer, emailOTP, jwt } from 'better-auth/plugins';
import { BetterAuthService } from './better-auth.service';

type SessionRow = { token: string; userId: string };

/**
 * 실제 better-auth 인스턴스(메모리 어댑터)로 이메일 인증 뒤 세션 폐기를 검증한다.
 * 가입 즉시 로그인 정책상 소유권 증명 전에 발급된 세션이 존재하므로, 인증(=소유권 증명) 시점에
 * 인증을 요청한 세션만 남기고 나머지를 폐기해야 한다.
 */
function makeAuth() {
  const db: Record<string, unknown[]> = { user: [], session: [], account: [], verification: [], jwks: [] };
  const otps = new Map<string, string>();
  const auth = betterAuth({
    baseURL: 'https://api.test',
    secret: 'test-secret-test-secret-test-secret-test',
    database: memoryAdapter(db),
    emailAndPassword: { enabled: true, requireEmailVerification: false, autoSignIn: false },
    plugins: [
      jwt(),
      bearer(),
      emailOTP({
        overrideDefaultEmailVerification: true,
        async sendVerificationOTP({ email, otp }) {
          otps.set(email, otp);
        },
      }),
    ],
  });
  return { auth, db, otps };
}

async function signUpAndSignIn(auth: ReturnType<typeof makeAuth>['auth'], email: string, sessions: number) {
  await auth.api.signUpEmail({ body: { name: '선생님', email, password: 'Passw0rd!x' } });
  const tokens: string[] = [];
  for (let i = 0; i < sessions; i++) {
    const res = await auth.api.signInEmail({ body: { email, password: 'Passw0rd!x', rememberMe: true } });
    tokens.push(res.token!);
  }
  return tokens;
}

function liveTokens(db: Record<string, unknown[]>, userId: string): string[] {
  return (db.session as SessionRow[]).filter(s => s.userId === userId).map(s => s.token);
}

describe('BetterAuthService.verifyEmail — 인증 시 미증명 세션 폐기', () => {
  it('인증을 요청한 세션 토큰이 그 사용자의 것이면 그 세션만 남기고 나머지를 폐기한다', async () => {
    const { auth, db, otps } = makeAuth();
    const service = new BetterAuthService(auth as never);
    const [attackerSession, ownerSession] = await signUpAndSignIn(auth, 'owner@example.com', 2);
    await auth.api.sendVerificationOTP({ body: { email: 'owner@example.com', type: 'email-verification' } });
    const userId = (db.user[0] as { id: string }).id;
    expect(liveTokens(db, userId)).toHaveLength(2);

    await service.verifyEmail('owner@example.com', otps.get('owner@example.com')!, ownerSession);

    expect(liveTokens(db, userId)).toEqual([ownerSession]);
    expect(liveTokens(db, userId)).not.toContain(attackerSession);
    expect((db.user[0] as { emailVerified: boolean }).emailVerified).toBe(true);
  });

  it('세션 토큰 없이 인증하면 그 사용자의 세션을 전부 폐기한다', async () => {
    const { auth, db, otps } = makeAuth();
    const service = new BetterAuthService(auth as never);
    await signUpAndSignIn(auth, 'owner@example.com', 2);
    await auth.api.sendVerificationOTP({ body: { email: 'owner@example.com', type: 'email-verification' } });
    const userId = (db.user[0] as { id: string }).id;

    await service.verifyEmail('owner@example.com', otps.get('owner@example.com')!);

    expect(liveTokens(db, userId)).toHaveLength(0);
  });

  it('세션 토큰이 다른 사용자의 것이면 인증된 사용자의 세션을 전부 폐기하고 그 다른 사용자의 세션은 건드리지 않는다', async () => {
    const { auth, db, otps } = makeAuth();
    const service = new BetterAuthService(auth as never);
    await signUpAndSignIn(auth, 'owner@example.com', 2);
    const [otherSession] = await signUpAndSignIn(auth, 'other@example.com', 1);
    await auth.api.sendVerificationOTP({ body: { email: 'owner@example.com', type: 'email-verification' } });
    const ownerId = (db.user[0] as { id: string }).id;
    const otherId = (db.user[1] as { id: string }).id;

    await service.verifyEmail('owner@example.com', otps.get('owner@example.com')!, otherSession);

    expect(liveTokens(db, ownerId)).toHaveLength(0);
    expect(liveTokens(db, otherId)).toEqual([otherSession]);
  });

  it('만료·폐기된 세션 토큰을 주면 토큰 없는 경우와 같이 전부 폐기한다', async () => {
    const { auth, db, otps } = makeAuth();
    const service = new BetterAuthService(auth as never);
    await signUpAndSignIn(auth, 'owner@example.com', 2);
    await auth.api.sendVerificationOTP({ body: { email: 'owner@example.com', type: 'email-verification' } });
    const userId = (db.user[0] as { id: string }).id;

    await service.verifyEmail('owner@example.com', otps.get('owner@example.com')!, 'not-a-real-session-token');

    expect(liveTokens(db, userId)).toHaveLength(0);
  });

  it('OTP 가 틀리면 세션을 건드리지 않는다', async () => {
    const { auth, db } = makeAuth();
    const service = new BetterAuthService(auth as never);
    const tokens = await signUpAndSignIn(auth, 'owner@example.com', 2);
    await auth.api.sendVerificationOTP({ body: { email: 'owner@example.com', type: 'email-verification' } });
    const userId = (db.user[0] as { id: string }).id;

    await expect(service.verifyEmail('owner@example.com', '000000', tokens[1])).rejects.toThrow();

    expect(liveTokens(db, userId)).toHaveLength(2);
  });
});
