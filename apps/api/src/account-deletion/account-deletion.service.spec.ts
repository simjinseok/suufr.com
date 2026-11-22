import { HttpException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import { Prisma } from '@prisma/generated/client';
import { AccountDeletionService, STALE_CLAIM_MS, SUPPORTED_LOGIN_PROVIDERS } from './account-deletion.service';

vi.mock('@sentry/nestjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const EMAIL = 'teacher@example.com';

type Account = { providerId: string; accountId: string; password: string | null; refreshToken?: string | null };
const credential: Account = { providerId: 'credential', accountId: USER, password: 'scrypt-hash' };
const googleLogin: Account = { providerId: 'google', accountId: 'g-1', password: null };
const appleWithToken: Account = { providerId: 'apple', accountId: 'apple-sub', password: null, refreshToken: 'encrypted-refresh' };
const appleWithoutToken: Account = { providerId: 'apple', accountId: 'apple-sub', password: null, refreshToken: null };

function p2002() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '7.10.1' });
}

function build(options: {
  accounts?: Account[];
  subscription?: Record<string, unknown> | null;
  googleConnected?: boolean;
  mediaPublicIds?: string[];
  organizations?: Array<{ logoImageKey: string | null; logoImageUrl: string | null; profileImageUrl: string | null }>;
  studentImages?: string[];
} = {}) {
  const tx = { marker: 'tx' };
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: USER, email: EMAIL, accounts: options.accounts ?? [credential] }),
    },
    accountDeletion: {
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
      // 삭제 트랜잭션이 저장한 legacy 키 (deleteUserRows 가 mock 이라 아래에서 그 인자를 돌려준다)
      findUnique: vi.fn(),
    },
    userSubscription: {
      findUnique: vi.fn().mockResolvedValue(options.subscription ?? null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    externalServiceToken: { findFirst: vi.fn().mockResolvedValue(options.googleConnected ? { id: 1 } : null) },
    mediaFile: { findMany: vi.fn().mockResolvedValue((options.mediaPublicIds ?? []).map(publicId => ({ publicId }))) },
    organization: { findMany: vi.fn().mockResolvedValue(options.organizations ?? []) },
    student: { findMany: vi.fn().mockResolvedValue((options.studentImages ?? []).map(profileImageUrl => ({ profileImageUrl }))) },
    $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  };
  const betterAuth = { verifyPassword: vi.fn().mockResolvedValue(true), revokeAppleAccount: vi.fn().mockResolvedValue('revoked') };
  const otp = { send: vi.fn().mockResolvedValue(undefined), verify: vi.fn().mockResolvedValue(undefined) };
  const userExistence = { invalidate: vi.fn() };
  const paddle = {
    cancelImmediately: vi.fn().mockResolvedValue({ status: 'canceled' }),
    getSubscription: vi.fn().mockResolvedValue({ status: 'active' }),
  };
  const google = { disconnect: vi.fn().mockResolvedValue(undefined), revokeToken: vi.fn().mockResolvedValue(true) };
  const s3 = {
    deleteByPrefix: vi.fn().mockResolvedValue(2),
    deleteFile: vi.fn().mockResolvedValue(true),
    invalidateCloudFrontPaths: vi.fn().mockResolvedValue(true),
  };
  const mail = { send: vi.fn().mockResolvedValue(undefined) };
  const config = { get: (key: string) => (key === 'BETTER_AUTH_SECRET' ? 'test-secret' : undefined) } as unknown as ConfigService;

  const service = new AccountDeletionService(
    prisma as never, betterAuth as never, otp as never, userExistence as never,
    paddle as never, google as never, s3 as never, mail as never, config,
  );
  let storedKeys: string[] = [];
  const deleteUserRows = vi.spyOn(service, 'deleteUserRows').mockImplementation(async (_tx, _userId, _email, legacyKeys = []) => {
    storedKeys = legacyKeys;
  });
  prisma.accountDeletion.findUnique.mockImplementation(async () => ({ pendingStorageKeys: storedKeys }));
  return { service, prisma, tx, betterAuth, otp, userExistence, paddle, google, s3, mail, deleteUserRows };
}

async function expectCode(promise: Promise<unknown>, code: string, status?: number) {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(HttpException);
  const http = error as HttpException;
  expect((http.getResponse() as { error: string }).error).toBe(code);
  if (status) expect(http.getStatus()).toBe(status);
  expect(typeof (http.getResponse() as { message: unknown }).message).toBe('string');
}

/** 아무것도 지우거나 바꾸지 않았는지 (선점 전 실패) */
function expectNothingTouched(ctx: ReturnType<typeof build>) {
  expect(ctx.prisma.accountDeletion.create).not.toHaveBeenCalled();
  expect(ctx.paddle.cancelImmediately).not.toHaveBeenCalled();
  expect(ctx.google.disconnect).not.toHaveBeenCalled();
  expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
  expect(ctx.s3.deleteByPrefix).not.toHaveBeenCalled();
}

const originalEnv = { ...process.env };
beforeEach(() => {
  process.env.CDN_URL = 'https://cdn.suufr.test';
  process.env.AWS_S3_BUCKET_NAME = 'suufr-bucket';
  process.env.AWS_REGION = 'ap-northeast-2';
  vi.mocked(Sentry.captureException).mockClear();
});
afterAll(() => {
  process.env = originalEnv;
});

describe('AccountDeletionService — 로그인 수단 가드', () => {
  it('처리할 줄 아는 로그인 수단은 credential·google·apple 뿐이다 (새 수단은 외부 토큰 폐기와 함께 이 목록을 고친다)', () => {
    expect([...SUPPORTED_LOGIN_PROVIDERS]).toEqual(['credential', 'google', 'apple']);
  });

  it('목록 밖 제공자의 연결 계정이 있으면 재인증 전에 거부하고 아무것도 하지 않는다', async () => {
    const ctx = build({ accounts: [credential, { providerId: 'kakao', accountId: 'k-1', password: null }] });
    await expectCode(ctx.service.deleteAccount(USER, { password: 'pw' }), 'ACCOUNT_DELETE_UNSUPPORTED_PROVIDER', 400);
    expect(ctx.betterAuth.verifyPassword).not.toHaveBeenCalled();
    expectNothingTouched(ctx);
  });

  it('코드 발송도 같은 기준으로 거부한다', async () => {
    const ctx = build({ accounts: [{ providerId: 'kakao', accountId: 'k-1', password: null }] });
    await expectCode(ctx.service.sendOtp(USER), 'ACCOUNT_DELETE_UNSUPPORTED_PROVIDER');
    expect(ctx.otp.send).not.toHaveBeenCalled();
  });
});

describe('AccountDeletionService — 재인증', () => {
  it('비밀번호 계정: 비밀번호가 틀리면 INVALID_PASSWORD(400 — 401 이 아님)이고 아무것도 지우지 않는다', async () => {
    const ctx = build();
    ctx.betterAuth.verifyPassword.mockResolvedValue(false);
    await expectCode(ctx.service.deleteAccount(USER, { password: 'wrong' }), 'ACCOUNT_DELETE_INVALID_PASSWORD', 400);
    expect(ctx.betterAuth.verifyPassword).toHaveBeenCalledWith(USER, 'wrong');
    expectNothingTouched(ctx);
  });

  it('비밀번호 계정: 비밀번호 없이(코드만) 오면 REAUTH_REQUIRED — 코드로 우회할 수 없다', async () => {
    const ctx = build({ accounts: [credential, googleLogin] });
    await expectCode(ctx.service.deleteAccount(USER, { otp: '123456' }), 'ACCOUNT_DELETE_REAUTH_REQUIRED', 400);
    expect(ctx.otp.verify).not.toHaveBeenCalled();
    expectNothingTouched(ctx);
  });

  it('비밀번호 없는 계정(Google 전용): 코드가 없으면 REAUTH_REQUIRED, 있으면 코드로 확인한다', async () => {
    const ctx = build({ accounts: [googleLogin] });
    await expectCode(ctx.service.deleteAccount(USER, { password: 'pw' }), 'ACCOUNT_DELETE_REAUTH_REQUIRED');
    expectNothingTouched(ctx);

    await ctx.service.deleteAccount(USER, { otp: '123456' });
    expect(ctx.otp.verify).toHaveBeenCalledWith(USER, '123456');
    expect(ctx.betterAuth.verifyPassword).not.toHaveBeenCalled();
  });

  it('credential 행이 있어도 비밀번호가 지워진 계정은 코드로 확인한다', async () => {
    const ctx = build({ accounts: [{ ...credential, password: null }, googleLogin] });
    await ctx.service.deleteAccount(USER, { otp: '123456' });
    expect(ctx.otp.verify).toHaveBeenCalled();
  });

  it('코드 확인 실패(만료 등)는 그대로 전파되고 아무것도 지우지 않는다', async () => {
    const ctx = build({ accounts: [googleLogin] });
    ctx.otp.verify.mockRejectedValue(new HttpException({ message: '만료', error: 'ACCOUNT_DELETE_OTP_EXPIRED' }, 400));
    await expectCode(ctx.service.deleteAccount(USER, { otp: '123456' }), 'ACCOUNT_DELETE_OTP_EXPIRED');
    expectNothingTouched(ctx);
  });

  it('비밀번호 계정은 코드를 받을 수 없다 (REAUTH_REQUIRED)', async () => {
    const ctx = build();
    await expectCode(ctx.service.sendOtp(USER), 'ACCOUNT_DELETE_REAUTH_REQUIRED');
    expect(ctx.otp.send).not.toHaveBeenCalled();
  });

  it('비밀번호 없는 계정은 계정 이메일로 코드를 보낸다', async () => {
    const ctx = build({ accounts: [googleLogin] });
    await ctx.service.sendOtp(USER);
    expect(ctx.otp.send).toHaveBeenCalledWith(USER, EMAIL);
  });
});

describe('AccountDeletionService — 선점', () => {
  it('이미 진행 중인 탈퇴가 있으면 409 이고, 남의 선점 행을 지우지 않는다', async () => {
    const ctx = build();
    ctx.prisma.accountDeletion.create.mockRejectedValue(p2002());
    await expectCode(ctx.service.deleteAccount(USER, { password: 'pw' }), 'ACCOUNT_DELETE_IN_PROGRESS', 409);
    expect(ctx.prisma.accountDeletion.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: USER, deletedAt: { lt: expect.any(Date) } },
    }));
    const cutoff = (ctx.prisma.accountDeletion.updateMany.mock.calls[0]![0] as { where: { deletedAt: { lt: Date } } }).where.deletedAt.lt;
    expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(STALE_CLAIM_MS - 1000);
    expect(ctx.prisma.accountDeletion.deleteMany).not.toHaveBeenCalled();
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('오래된 미완료 선점은 넘겨받아 계속한다', async () => {
    const ctx = build();
    ctx.prisma.accountDeletion.create.mockRejectedValue(p2002());
    ctx.prisma.accountDeletion.updateMany.mockResolvedValue({ count: 1 });
    await ctx.service.deleteAccount(USER, { password: 'pw' });
    expect(ctx.prisma.$transaction).toHaveBeenCalled();
  });

  it('선점 행에는 원문 이메일이 아니라 HMAC 만 남는다 (대소문자·공백 무관하게 같은 값)', async () => {
    const ctx = build();
    await ctx.service.deleteAccount(USER, { password: 'pw' });
    const data = ctx.prisma.accountDeletion.create.mock.calls[0]![0].data as { userId: string; emailHmac: string };
    expect(data.userId).toBe(USER);
    expect(data.emailHmac).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(data)).not.toContain(EMAIL);
    expect(ctx.service.emailHmac('  Teacher@Example.COM ')).toBe(data.emailHmac);
  });
});

describe('AccountDeletionService — 구독 해지', () => {
  const paddleSub = { userId: USER, provider: 'paddle', providerSubscriptionId: 'sub_1', status: 'active', canceledAt: null };

  it('Paddle 즉시 해지가 실패하면 아무것도 지우지 않고 선점을 풀고 502', async () => {
    const ctx = build({ subscription: paddleSub, googleConnected: true });
    ctx.paddle.cancelImmediately.mockRejectedValue(new Error('paddle down'));
    await expectCode(ctx.service.deleteAccount(USER, { password: 'pw' }), 'ACCOUNT_DELETE_SUBSCRIPTION_CANCEL_FAILED', 502);
    expect(ctx.prisma.accountDeletion.deleteMany).toHaveBeenCalledWith({ where: { userId: USER, deletedAt: expect.any(Date) } });
    expect(ctx.prisma.userSubscription.updateMany).not.toHaveBeenCalled();
    expect(ctx.google.disconnect).not.toHaveBeenCalled();
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
    expect(ctx.s3.deleteByPrefix).not.toHaveBeenCalled();
    expect(ctx.userExistence.invalidate).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('해지 요청이 거부돼도 원격이 이미 canceled 면 계속한다', async () => {
    const ctx = build({ subscription: paddleSub });
    ctx.paddle.cancelImmediately.mockRejectedValue(new Error('subscription_locked'));
    ctx.paddle.getSubscription.mockResolvedValue({ status: 'canceled' });
    await ctx.service.deleteAccount(USER, { password: 'pw' });
    expect(ctx.prisma.$transaction).toHaveBeenCalled();
  });

  it('성공하면 즉시 해지하고 로컬 행도 바로 종료 상태로 바꾼다', async () => {
    const ctx = build({ subscription: paddleSub });
    await ctx.service.deleteAccount(USER, { password: 'pw' });
    expect(ctx.paddle.cancelImmediately).toHaveBeenCalledWith('sub_1');
    expect(ctx.prisma.userSubscription.updateMany).toHaveBeenCalledWith({
      where: { userId: USER, provider: 'paddle', providerSubscriptionId: 'sub_1' },
      data: expect.objectContaining({ status: 'expired' }),
    });
    expect(ctx.paddle.cancelImmediately.mock.invocationCallOrder[0]).toBeLessThan(ctx.prisma.$transaction.mock.invocationCallOrder[0]!);
  });

  it('manual·이미 종료된 구독은 Paddle 을 부르지 않는다', async () => {
    for (const subscription of [
      { ...paddleSub, provider: 'manual', providerSubscriptionId: null },
      { ...paddleSub, status: 'expired' },
    ]) {
      const ctx = build({ subscription });
      await ctx.service.deleteAccount(USER, { password: 'pw' });
      expect(ctx.paddle.cancelImmediately).not.toHaveBeenCalled();
      expect(ctx.prisma.$transaction).toHaveBeenCalled();
    }
  });
});

describe('AccountDeletionService — 삭제', () => {
  it('성공: 트랜잭션 → 캐시 무효화 → S3 두 prefix 삭제·무효화 → storage_purged_at → 완료 메일', async () => {
    const ctx = build({ googleConnected: true });
    await ctx.service.deleteAccount(USER, { password: 'pw' });

    expect(ctx.deleteUserRows).toHaveBeenCalledWith(ctx.tx, USER, EMAIL, []);
    expect(ctx.userExistence.invalidate).toHaveBeenCalledWith(USER);
    expect(ctx.s3.deleteByPrefix.mock.calls.map(c => c[0])).toEqual([`users/${USER}/`, `images/profiles/${USER}/`]);
    expect(ctx.s3.invalidateCloudFrontPaths).toHaveBeenCalledWith(expect.arrayContaining([`/images/profiles/${USER}/*`]));
    expect(ctx.prisma.accountDeletion.update).toHaveBeenCalledWith({ where: { userId: USER }, data: { storagePurgedAt: expect.any(Date), pendingStorageKeys: [] } });
    expect(ctx.mail.send).toHaveBeenCalledWith(expect.objectContaining({ to: EMAIL, subject: '[스프] 계정이 삭제되었습니다' }));
    expect(ctx.prisma.accountDeletion.deleteMany).not.toHaveBeenCalled();

    // 외부 정리는 트랜잭션(accounts Cascade) 앞
    expect(ctx.google.disconnect).toHaveBeenCalledWith(USER);
    expect(ctx.google.revokeToken).toHaveBeenCalledWith(USER);
    expect(ctx.google.revokeToken.mock.invocationCallOrder[0]).toBeLessThan(ctx.prisma.$transaction.mock.invocationCallOrder[0]!);
    expect(ctx.prisma.$transaction.mock.invocationCallOrder[0]).toBeLessThan(ctx.s3.deleteByPrefix.mock.invocationCallOrder[0]!);
  });

  it('Google 연동 정리 실패는 탈퇴를 막지 않는다', async () => {
    const ctx = build({ googleConnected: true });
    ctx.google.disconnect.mockRejectedValue(new Error('google down'));
    ctx.google.revokeToken.mockRejectedValue(new Error('google down'));
    await ctx.service.deleteAccount(USER, { password: 'pw' });
    expect(ctx.prisma.$transaction).toHaveBeenCalled();
  });

  it('트랜잭션이 두 번 실패하면 이 요청의 선점만 풀고 오류를 내며, S3·캐시는 건드리지 않는다 (Sentry 에 구독 해지 여부)', async () => {
    const ctx = build();
    ctx.prisma.$transaction.mockRejectedValue(new Error('tx failed'));
    await expect(ctx.service.deleteAccount(USER, { password: 'pw' })).rejects.toThrow('tx failed');
    expect(ctx.prisma.$transaction).toHaveBeenCalledTimes(2);
    const claimedAt = (ctx.prisma.accountDeletion.create.mock.calls[0]![0] as { data: { deletedAt: Date } }).data.deletedAt;
    expect(claimedAt.getMilliseconds()).toBe(0);
    expect(ctx.prisma.accountDeletion.deleteMany).toHaveBeenCalledWith({ where: { userId: USER, deletedAt: claimedAt } });
    expect(ctx.s3.deleteByPrefix).not.toHaveBeenCalled();
    expect(ctx.userExistence.invalidate).not.toHaveBeenCalled();
    expect(ctx.mail.send).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({
      extra: { userId: USER, attempts: 2, canceledSubscription: false },
    }));
  });

  it('트랜잭션이 한 번 실패해도 재시도가 성공하면 탈퇴를 끝낸다', async () => {
    const ctx = build();
    ctx.prisma.$transaction.mockRejectedValueOnce(new Error('fk violation'));
    await ctx.service.deleteAccount(USER, { password: 'pw' });
    expect(ctx.prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(ctx.prisma.accountDeletion.deleteMany).not.toHaveBeenCalled();
    expect(ctx.userExistence.invalidate).toHaveBeenCalledWith(USER);
  });

  it('실패했는데 users 가 이미 없으면(커밋 후 응답 단절·넘겨받은 요청이 완료) 탈퇴 기록을 지우지 않고 완료로 끝낸다', async () => {
    const ctx = build();
    const loaded = await ctx.prisma.user.findUnique();
    ctx.prisma.user.findUnique.mockReset()
      .mockResolvedValueOnce(loaded) // loadUser
      .mockResolvedValue(null); // 실패 뒤 확인
    ctx.prisma.$transaction.mockRejectedValue(new Error('connection terminated'));
    await expect(ctx.service.deleteAccount(USER, { password: 'pw' })).resolves.toBeUndefined();
    // 커밋됐을 수 있는 트랜잭션은 다시 돌리지 않는다
    expect(ctx.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(ctx.prisma.accountDeletion.deleteMany).not.toHaveBeenCalled();
    expect(ctx.userExistence.invalidate).toHaveBeenCalledWith(USER);
  });

  it('users 확인 조회마저 실패하면 모르는 것으로 보고 선점을 푼다 (users 는 남아 있을 가능성이 크다)', async () => {
    const ctx = build();
    const loaded = await ctx.prisma.user.findUnique();
    ctx.prisma.user.findUnique.mockReset()
      .mockResolvedValueOnce(loaded)
      .mockRejectedValue(new Error('db down'));
    ctx.prisma.$transaction.mockRejectedValue(new Error('db down'));
    await expect(ctx.service.deleteAccount(USER, { password: 'pw' })).rejects.toThrow('db down');
    expect(ctx.prisma.accountDeletion.deleteMany).toHaveBeenCalledWith({ where: { userId: USER, deletedAt: expect.any(Date) } });
  });

  it('커밋 뒤 S3 삭제가 실패해도 탈퇴는 성공으로 끝나고, storage_purged_at 을 남기지 않아 크론이 재시도한다', async () => {
    const ctx = build();
    ctx.s3.deleteByPrefix.mockRejectedValue(new Error('s3 down'));
    await expect(ctx.service.deleteAccount(USER, { password: 'pw' })).resolves.toBeUndefined();
    expect(ctx.prisma.accountDeletion.update).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalled();
    expect(ctx.userExistence.invalidate).toHaveBeenCalledWith(USER);
  });

  it('사용자 prefix 밖의 legacy 키(우리 CDN·버킷·키)만 따로 지우고, 외부 URL·다른 사용자 prefix 는 건드리지 않는다', async () => {
    const ctx = build({
      mediaPublicIds: [`users/${USER}/images/a.jpg`],
      organizations: [{ logoImageKey: 'logos/legacy.png', logoImageUrl: `https://cdn.suufr.test/images/profiles/${USER}/x.png`, profileImageUrl: 'https://lh3.googleusercontent.com/abc' }],
      studentImages: [
        'https://suufr-bucket.s3.ap-northeast-2.amazonaws.com/images/0f0f.jpg',
        `https://cdn.suufr.test/users/${OTHER}/images/b.jpg`,
        `https://cdn.suufr.test/images/profiles/${OTHER}/c.jpg`,
      ],
    });
    await ctx.service.deleteAccount(USER, { password: 'pw' });
    // 키는 삭제 트랜잭션에 저장되고(크론 재시도용), 스토리지 삭제는 저장된 키를 읽어 지운다
    expect((ctx.deleteUserRows.mock.calls[0]![3] as string[]).sort()).toEqual(['images/0f0f.jpg', 'logos/legacy.png']);
    expect(ctx.s3.deleteFile.mock.calls.map(c => c[0]).sort()).toEqual(['images/0f0f.jpg', 'logos/legacy.png']);
  });

  it('크론 재시도(purgeStorage)는 탈퇴 기록에 저장된 legacy 키까지 지우고, 성공하면 비운다', async () => {
    const ctx = build();
    ctx.prisma.accountDeletion.findUnique.mockResolvedValue({ pendingStorageKeys: ['photos/legacy-1.jpg'] });
    await expect(ctx.service.purgeStorage(USER)).resolves.toBe(true);
    expect(ctx.s3.deleteByPrefix).toHaveBeenCalledTimes(2);
    expect(ctx.s3.deleteFile).toHaveBeenCalledWith('photos/legacy-1.jpg');
    expect(ctx.prisma.accountDeletion.update).toHaveBeenCalledWith({ where: { userId: USER }, data: { storagePurgedAt: expect.any(Date), pendingStorageKeys: [] } });
  });

  it('legacy 키 하나라도 지우지 못하면 파기 완료로 기록하지 않는다 (키는 남아 다음 재시도 대상)', async () => {
    const ctx = build();
    ctx.prisma.accountDeletion.findUnique.mockResolvedValue({ pendingStorageKeys: ['photos/legacy-1.jpg'] });
    ctx.s3.deleteFile.mockResolvedValue(false);
    await expect(ctx.service.purgeStorage(USER)).resolves.toBe(false);
    expect(ctx.prisma.accountDeletion.update).not.toHaveBeenCalled();
  });
});

describe('AccountDeletionService — Apple 토큰 폐기', () => {
  it('저장된 refresh token 을 구독 해지·DB 삭제보다 먼저 폐기하고 탈퇴를 끝낸다', async () => {
    const ctx = build({ accounts: [appleWithToken], subscription: { provider: 'paddle', providerSubscriptionId: 'sub_1', status: 'active', canceledAt: null } });
    await ctx.service.deleteAccount(USER, { otp: '123456' });

    expect(ctx.betterAuth.revokeAppleAccount).toHaveBeenCalledWith('apple-sub', undefined);
    const revokeOrder = ctx.betterAuth.revokeAppleAccount.mock.invocationCallOrder[0];
    expect(revokeOrder).toBeLessThan(ctx.paddle.cancelImmediately.mock.invocationCallOrder[0]);
    expect(revokeOrder).toBeLessThan(ctx.prisma.$transaction.mock.invocationCallOrder[0]);
    expect(ctx.deleteUserRows).toHaveBeenCalled();
  });

  it('저장된 토큰이 없고 authorization code 도 없으면 코드를 확인(소진)하기 전에 APPLE_REAUTH_REQUIRED 이고 아무것도 하지 않는다', async () => {
    const ctx = build({ accounts: [appleWithoutToken] });
    await expectCode(ctx.service.deleteAccount(USER, { otp: '123456' }), 'ACCOUNT_DELETE_APPLE_REAUTH_REQUIRED', 400);
    expect(ctx.otp.verify).not.toHaveBeenCalled();
    expect(ctx.betterAuth.revokeAppleAccount).not.toHaveBeenCalled();
    expectNothingTouched(ctx);
  });

  it('저장된 토큰이 없어도 authorization code 가 오면 그 code 로 폐기한다', async () => {
    const ctx = build({ accounts: [appleWithoutToken] });
    await ctx.service.deleteAccount(USER, { otp: '123456', appleAuthorizationCode: 'apple-code' });
    expect(ctx.betterAuth.revokeAppleAccount).toHaveBeenCalledWith('apple-sub', 'apple-code');
    expect(ctx.deleteUserRows).toHaveBeenCalled();
  });

  it('폐기가 실패하면 구독을 해지하지 않고 아무것도 지우지 않으며 선점을 풀고 502 (Sentry 기록)', async () => {
    const ctx = build({ accounts: [credential, appleWithToken], subscription: { provider: 'paddle', providerSubscriptionId: 'sub_1', status: 'active', canceledAt: null } });
    ctx.betterAuth.revokeAppleAccount.mockRejectedValue(new Error('Apple revoke 요청 실패: 503'));

    await expectCode(ctx.service.deleteAccount(USER, { password: 'pw' }), 'ACCOUNT_DELETE_APPLE_REVOKE_FAILED', 502);
    expect(ctx.paddle.cancelImmediately).not.toHaveBeenCalled();
    expect(ctx.google.disconnect).not.toHaveBeenCalled();
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
    expect(ctx.prisma.accountDeletion.deleteMany).toHaveBeenCalledWith({ where: { userId: USER, deletedAt: expect.any(Date) } });
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('저장된 토큰을 쓸 수 없으면(no-token) APPLE_REAUTH_REQUIRED 로 알리고 선점을 푼다', async () => {
    const ctx = build({ accounts: [appleWithToken] });
    ctx.betterAuth.revokeAppleAccount.mockResolvedValue('no-token');

    await expectCode(ctx.service.deleteAccount(USER, { otp: '123456' }), 'ACCOUNT_DELETE_APPLE_REAUTH_REQUIRED', 400);
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
    expect(ctx.prisma.accountDeletion.deleteMany).toHaveBeenCalled();
  });

  it('Apple 이 아닌 계정은 Apple 폐기를 부르지 않는다', async () => {
    const ctx = build({ accounts: [credential, googleLogin] });
    await ctx.service.deleteAccount(USER, { password: 'pw' });
    expect(ctx.betterAuth.revokeAppleAccount).not.toHaveBeenCalled();
  });
});
