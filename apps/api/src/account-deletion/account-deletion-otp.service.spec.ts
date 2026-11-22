import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { MailDeliveryError } from '../mail/mail.service';
import {
  ACCOUNT_DELETION_OTP_COOLDOWN_MS,
  ACCOUNT_DELETION_OTP_MAX_ATTEMPTS,
  ACCOUNT_DELETION_OTP_TTL_MS,
  AccountDeletionOtpService,
} from './account-deletion-otp.service';

const USER = '11111111-1111-4111-8111-111111111111';
const IDENTIFIER = `delete-account-otp:${USER}`;

type Row = { id: string; identifier: string; value: string; expiresAt: Date; createdAt: Date };

/** verifications 한 테이블만 흉내 내는 in-memory prisma */
function build() {
  let rows: Row[] = [];
  const matches = (row: Row, where: Partial<Row>) => Object.entries(where).every(([k, v]) => row[k as keyof Row] === v);
  const verification = {
    // DB 처럼 읽은 시점의 사본을 돌려준다 (같은 객체를 돌려주면 동시 요청 경합이 재현되지 않는다)
    findFirst: vi.fn(async ({ where }: { where: Partial<Row> }) => {
      const found = rows.filter(r => matches(r, where)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      return found ? { ...found } : null;
    }),
    deleteMany: vi.fn(async ({ where }: { where: Partial<Row> }) => {
      const before = rows.length;
      rows = rows.filter(r => !matches(r, where));
      return { count: before - rows.length };
    }),
    create: vi.fn(async ({ data }: { data: Omit<Row, 'createdAt'> }) => {
      const row = { ...data, createdAt: new Date() };
      rows.push(row);
      return row;
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Partial<Row>; data: Partial<Row> }) => {
      const hit = rows.filter(r => matches(r, where));
      hit.forEach(r => Object.assign(r, data));
      return { count: hit.length };
    }),
  };
  const prisma = {
    verification,
    // 배열 형식 $transaction: 순서대로 실행
    $transaction: vi.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops)),
  };
  const sent: string[] = [];
  const mail = {
    sendOrThrow: vi.fn(async (message: { text: string }) => {
      sent.push(message.text.match(/\b\d{6}\b/)?.[0] ?? '');
    }),
  };
  const config = { get: (key: string) => (key === 'BETTER_AUTH_SECRET' ? 'test-secret' : undefined) } as unknown as ConfigService;
  const service = new AccountDeletionOtpService(prisma as never, mail as never, config);
  return { service, prisma, mail, sent, rows: () => rows };
}

async function errorCode(promise: Promise<unknown>): Promise<string | undefined> {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(HttpException);
  return ((error as HttpException).getResponse() as { error?: string }).error;
}

describe('AccountDeletionOtpService', () => {
  afterEach(() => vi.useRealTimers());

  it('6자리 코드를 메일로 보내고, 해시만 저장한다 (10분 만료)', async () => {
    const ctx = build();
    await ctx.service.send(USER, 'a@example.com');
    const [row] = ctx.rows();
    expect(ctx.sent[0]).toMatch(/^\d{6}$/);
    expect(row!.identifier).toBe(IDENTIFIER);
    expect(row!.value).not.toContain(ctx.sent[0]);
    expect(row!.value).toMatch(/^[0-9a-f]{64}:0$/);
    expect(row!.expiresAt.getTime() - Date.now()).toBeGreaterThan(ACCOUNT_DELETION_OTP_TTL_MS - 5000);
    expect(ACCOUNT_DELETION_OTP_TTL_MS).toBe(10 * 60_000);
  });

  it('60초 안에 다시 요청하면 429, 지나면 새 코드로 바꾼다', async () => {
    vi.useFakeTimers();
    const ctx = build();
    await ctx.service.send(USER, 'a@example.com');
    const error = await ctx.service.send(USER, 'a@example.com').catch((e: HttpException) => e);
    expect((error as HttpException).getStatus()).toBe(429);

    vi.advanceTimersByTime(ACCOUNT_DELETION_OTP_COOLDOWN_MS + 1);
    await ctx.service.send(USER, 'a@example.com');
    expect(ctx.rows()).toHaveLength(1);
    await expect(ctx.service.verify(USER, ctx.sent[1]!)).resolves.toBeUndefined();
  });

  it('메일 발송이 실패하면 503 이고 코드를 남기지 않는다 (쿨다운도 걸리지 않음)', async () => {
    const ctx = build();
    ctx.mail.sendOrThrow.mockRejectedValueOnce(new MailDeliveryError('ses down'));
    await expect(ctx.service.send(USER, 'a@example.com')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(ctx.rows()).toHaveLength(0);
    await ctx.service.send(USER, 'a@example.com');
    expect(ctx.rows()).toHaveLength(1);
  });

  it('맞는 코드는 한 번만 통과한다 (재사용 불가)', async () => {
    const ctx = build();
    await ctx.service.send(USER, 'a@example.com');
    await ctx.service.verify(USER, ctx.sent[0]!);
    expect(await errorCode(ctx.service.verify(USER, ctx.sent[0]!))).toBe('ACCOUNT_DELETE_INVALID_OTP');
  });

  it('요청한 적 없으면 INVALID_OTP', async () => {
    expect(await errorCode(build().service.verify(USER, '123456'))).toBe('ACCOUNT_DELETE_INVALID_OTP');
  });

  it('만료되면 OTP_EXPIRED 이고 행을 지운다', async () => {
    vi.useFakeTimers();
    const ctx = build();
    await ctx.service.send(USER, 'a@example.com');
    vi.advanceTimersByTime(ACCOUNT_DELETION_OTP_TTL_MS + 1);
    expect(await errorCode(ctx.service.verify(USER, ctx.sent[0]!))).toBe('ACCOUNT_DELETE_OTP_EXPIRED');
    expect(ctx.rows()).toHaveLength(0);
  });

  it('5번 틀리면 그다음부터는 맞는 코드도 TOO_MANY_ATTEMPTS 이고, 행을 남겨 재발송 쿨다운도 유지한다', async () => {
    const ctx = build();
    await ctx.service.send(USER, 'a@example.com');
    const wrong = ctx.sent[0] === '000000' ? '111111' : '000000';
    for (let i = 0; i < ACCOUNT_DELETION_OTP_MAX_ATTEMPTS; i++) {
      expect(await errorCode(ctx.service.verify(USER, wrong))).toBe('ACCOUNT_DELETE_INVALID_OTP');
    }
    expect(ctx.rows()[0]!.value.endsWith(`:${ACCOUNT_DELETION_OTP_MAX_ATTEMPTS}`)).toBe(true);
    expect(await errorCode(ctx.service.verify(USER, ctx.sent[0]!))).toBe('ACCOUNT_DELETE_OTP_TOO_MANY_ATTEMPTS');
    expect(await errorCode(ctx.service.verify(USER, ctx.sent[0]!))).toBe('ACCOUNT_DELETE_OTP_TOO_MANY_ATTEMPTS');
    expect(ctx.rows()).toHaveLength(1);
    // 소진했다고 바로 새 코드를 받을 수는 없다
    const error = await ctx.service.send(USER, 'a@example.com').catch((e: HttpException) => e);
    expect((error as HttpException).getStatus()).toBe(429);
  });

  it('틀린 코드를 동시에 여러 개 보내도 비교 한 번마다 시도 횟수가 하나씩 오르고, 한도를 넘는 비교는 하지 않는다', async () => {
    const ctx = build();
    await ctx.service.send(USER, 'a@example.com');
    const wrongCodes = Array.from({ length: 12 }, (_, i) => String(i).padStart(6, '0')).filter(code => code !== ctx.sent[0]);
    const results = await Promise.all(wrongCodes.map(code => errorCode(ctx.service.verify(USER, code))));
    expect(ctx.rows()[0]!.value.endsWith(`:${ACCOUNT_DELETION_OTP_MAX_ATTEMPTS}`)).toBe(true);
    // 비교까지 간 요청은 정확히 한도만큼, 나머지는 TOO_MANY_ATTEMPTS
    expect(results.filter(code => code === 'ACCOUNT_DELETE_INVALID_OTP')).toHaveLength(ACCOUNT_DELETION_OTP_MAX_ATTEMPTS);
    expect(results.filter(code => code === 'ACCOUNT_DELETE_OTP_TOO_MANY_ATTEMPTS')).toHaveLength(wrongCodes.length - ACCOUNT_DELETION_OTP_MAX_ATTEMPTS);
    // 한도를 넘긴 뒤에는 맞는 코드도 통과하지 못한다
    expect(await errorCode(ctx.service.verify(USER, ctx.sent[0]!))).toBe('ACCOUNT_DELETE_OTP_TOO_MANY_ATTEMPTS');
  });

  it('같은 맞는 코드가 동시에 두 번 와도 한 번만 통과한다', async () => {
    const ctx = build();
    await ctx.service.send(USER, 'a@example.com');
    const outcomes = await Promise.allSettled([ctx.service.verify(USER, ctx.sent[0]!), ctx.service.verify(USER, ctx.sent[0]!)]);
    expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1);
  });
});
