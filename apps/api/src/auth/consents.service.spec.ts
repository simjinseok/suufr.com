import { ConsentsService } from './consents.service';
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from '../common/constants/legal';
import type { PrismaService } from '../prisma/prisma.service';

type Row = { type: 'terms' | 'privacy' | 'overseas_transfer'; docVersion: string; agreed: boolean };

function makeService(rows: Row[] = []) {
  const createMany = vi.fn().mockResolvedValue({ count: 3 });
  const findMany = vi.fn().mockResolvedValue(rows);
  const prisma = { userConsent: { createMany, findMany } } as unknown as PrismaService;
  return { service: new ConsentsService(prisma), createMany, findMany };
}

const input = {
  terms: true,
  privacy: true,
  overseasTransfer: true,
  termsVersion: TERMS_VERSION,
  privacyVersion: PRIVACY_POLICY_VERSION,
};

describe('ConsentsService.record', () => {
  it('동의 3종을 한 번에 기록하고 국외 이전은 방침 버전에 귀속한다', async () => {
    const { service, createMany } = makeService();
    await service.record('user-1', input, { ipAddress: '1.2.3.4', userAgent: 'UA' });

    const { data } = createMany.mock.calls[0][0];
    expect(data).toHaveLength(3);
    expect(data.map((d: { type: string }) => d.type)).toEqual(['terms', 'privacy', 'overseas_transfer']);
    expect(data[2].docVersion).toBe(PRIVACY_POLICY_VERSION);
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

describe('ConsentsService.getStatus', () => {
  it('이력이 없으면 모두 null 이고 required 다', async () => {
    const { service } = makeService([]);
    const status = await service.getStatus('user-1');
    expect(status).toEqual({ terms: null, privacy: null, overseasTransfer: null, required: true });
  });

  it('현재 버전에 모두 동의했으면 required 가 아니다', async () => {
    const { service } = makeService([
      { type: 'overseas_transfer', docVersion: PRIVACY_POLICY_VERSION, agreed: true },
      { type: 'privacy', docVersion: PRIVACY_POLICY_VERSION, agreed: true },
      { type: 'terms', docVersion: TERMS_VERSION, agreed: true },
    ]);
    const status = await service.getStatus('user-1');
    expect(status.required).toBe(false);
    expect(status.terms).toBe(TERMS_VERSION);
  });

  it('구 버전 동의만 있으면 required 다', async () => {
    const { service } = makeService([
      { type: 'overseas_transfer', docVersion: '2000-01-01', agreed: true },
      { type: 'privacy', docVersion: PRIVACY_POLICY_VERSION, agreed: true },
      { type: 'terms', docVersion: TERMS_VERSION, agreed: true },
    ]);
    expect((await service.getStatus('user-1')).required).toBe(true);
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
    expect(status.required).toBe(true);
  });
});
