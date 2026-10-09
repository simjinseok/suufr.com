import { SettingsService } from './settings.service';
import type { PrismaService } from '../prisma/prisma.service';

// stored: u1 의 user_settings 행 (null = 행 없음)
function makeService(stored: { timezone: string | null } | null = null) {
  const upsert = vi.fn().mockResolvedValue({ userId: 'u1', defaultPaymentMethod: 'card' });
  const findUnique = vi.fn(async ({ where }: { where: { userId: string } }) => (where.userId === 'u1' ? stored : null));
  const prisma = { userSettings: { upsert, findUnique } } as unknown as PrismaService;
  return { service: new SettingsService(prisma), upsert };
}

describe('SettingsService.update defaultPaymentMethod', () => {
  it('보내면 update 와 create 양쪽에 반영한다', async () => {
    const { service, upsert } = makeService();
    await service.update('u1', { defaultPaymentMethod: 'card' });

    const { update, create } = upsert.mock.calls[0][0];
    expect(update.defaultPaymentMethod).toBe('card');
    expect(create.defaultPaymentMethod).toBe('card');
    expect(create.userId).toBe('u1');
  });

  it('보내지 않으면 건드리지 않는다 (다른 설정만 바꿔도 기본 결제수단이 리셋되지 않는다)', async () => {
    const { service, upsert } = makeService();
    await service.update('u1', { defaultDuration: 90 });

    const { update, create } = upsert.mock.calls[0][0];
    expect('defaultPaymentMethod' in update).toBe(false);
    expect('defaultPaymentMethod' in create).toBe(false);
  });
});

describe('SettingsService.resolveTimezone', () => {
  it('명시 타임존이 있으면 유저 설정보다 우선한다', async () => {
    const { service } = makeService({ timezone: 'Asia/Seoul' });
    await expect(service.resolveTimezone('u1', 'America/New_York')).resolves.toBe('America/New_York');
  });

  it('명시 타임존이 없으면 그 유저의 설정 타임존을 쓴다', async () => {
    const { service } = makeService({ timezone: 'Asia/Seoul' });
    await expect(service.resolveTimezone('u1')).resolves.toBe('Asia/Seoul');
  });

  it('설정에 타임존이 비어 있으면 UTC 를 쓴다', async () => {
    const { service } = makeService({ timezone: null });
    await expect(service.resolveTimezone('u1')).resolves.toBe('UTC');
  });

  it('설정 행이 없어도 UTC 를 쓴다', async () => {
    const { service } = makeService(null);
    await expect(service.resolveTimezone('u1')).resolves.toBe('UTC');
  });
});
