import { ConsentsService } from './consents.service';
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from '../common/constants/legal';
import type { PrismaService } from '../prisma/prisma.service';

type Row = { type: 'terms' | 'privacy' | 'overseas_transfer'; docVersion: string; agreed: boolean }; // overseas_transfer: 과거 이력 행

function makeService(rows: Row[] = []) {
  const createMany = vi.fn().mockResolvedValue({ count: 2 });
  const findMany = vi.fn().mockResolvedValue(rows);
  const count = vi.fn().mockResolvedValue(rows.length);
  const prisma = { userConsent: { createMany, findMany, count } } as unknown as PrismaService;
  return { service: new ConsentsService(prisma), createMany, findMany };
}

const input = {
  terms: true,
  privacy: true,
  termsVersion: TERMS_VERSION,
  privacyVersion: PRIVACY_POLICY_VERSION,
};

describe('ConsentsService.record', () => {
  it('동의 2종(약관·방침)을 한 번에 기록하고 국외 이전 행은 만들지 않는다', async () => {
    const { service, createMany } = makeService();
    await service.record('user-1', input, { ipAddress: '1.2.3.4', userAgent: 'UA' });

    const { data } = createMany.mock.calls[0][0];
    expect(data).toHaveLength(2);
    expect(data.map((d: { type: string }) => d.type)).toEqual(['terms', 'privacy']);
    expect(data[1].docVersion).toBe(PRIVACY_POLICY_VERSION);
    expect(data[0]).toMatchObject({ userId: 'user-1', ipAddress: '1.2.3.4', userAgent: 'UA' });
  });

  it('UA 는 512자, IP 는 45자로 절단한다', async () => {
    const { service, createMany } = makeService();
    await service.record('user-1', input, { ipAddress: 'x'.repeat(60), userAgent: 'y'.repeat(600) });
    const { data } = createMany.mock.calls[0][0];
    expect(data[0].ipAddress).toHaveLength(45);
    expect(data[0].userAgent).toHaveLength(512);
  });

  it('recordSafely 는 DB 실패를 전파하지 않는다', async () => {
    const { service, createMany } = makeService();
    createMany.mockRejectedValueOnce(new Error('db down'));
    await expect(service.recordSafely('user-1', input)).resolves.toBeUndefined();
  });
});

describe('ConsentsService.recordIfAbsent', () => {
  it('이력이 없으면 기록하고 true', async () => {
    const { service, createMany } = makeService([]);
    await expect(service.recordIfAbsent('user-1', input)).resolves.toBe(true);
    expect(createMany).toHaveBeenCalledTimes(1);
  });

  it('이력이 하나라도 있으면 기록하지 않고 false (iOS 가 로그인마다 동의값을 보내도 1회만 남긴다)', async () => {
    const { service, createMany } = makeService([{ type: 'terms', docVersion: '2000-01-01', agreed: true }]);
    await expect(service.recordIfAbsent('user-1', input)).resolves.toBe(false);
    expect(createMany).not.toHaveBeenCalled();
  });
});

describe('ConsentsService.getStatus', () => {
  it('이력이 없으면 모두 null', async () => {
    const { service } = makeService([]);
    expect(await service.getStatus('user-1')).toEqual({ terms: null, privacy: null });
  });

  it('타입별 최신 동의 버전을 돌려준다 (과거 국외 이전 행은 무시)', async () => {
    const { service } = makeService([
      { type: 'overseas_transfer', docVersion: '2000-01-01', agreed: true },
      { type: 'privacy', docVersion: PRIVACY_POLICY_VERSION, agreed: true },
      { type: 'terms', docVersion: TERMS_VERSION, agreed: true },
    ]);
    expect(await service.getStatus('user-1')).toEqual({ terms: TERMS_VERSION, privacy: PRIVACY_POLICY_VERSION });
  });

  it('구 버전 동의도 그대로 돌려준다 — 개정 시 재동의를 요구하지 않는다', async () => {
    const { service } = makeService([
      { type: 'privacy', docVersion: '2000-01-01', agreed: true },
      { type: 'terms', docVersion: TERMS_VERSION, agreed: true },
    ]);
    expect((await service.getStatus('user-1')).privacy).toBe('2000-01-01');
  });

  it('최신순 행 중 타입별 첫 행만 본다 (철회 행이 최신이면 null)', async () => {
    const { service } = makeService([
      { type: 'terms', docVersion: TERMS_VERSION, agreed: false }, // 최신: 철회
      { type: 'terms', docVersion: TERMS_VERSION, agreed: true },
      { type: 'privacy', docVersion: PRIVACY_POLICY_VERSION, agreed: true },
      { type: 'overseas_transfer', docVersion: PRIVACY_POLICY_VERSION, agreed: true },
    ]);
    const status = await service.getStatus('user-1');
    expect(status.terms).toBeNull();
    expect(status.privacy).toBe(PRIVACY_POLICY_VERSION);
  });
});
