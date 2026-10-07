import { SettingsService } from './settings.service';
import type { PrismaService } from '../prisma/prisma.service';

function makeService() {
  const upsert = vi.fn().mockResolvedValue({ userId: 'u1', defaultPaymentMethod: 'card' });
  const prisma = { userSettings: { upsert } } as unknown as PrismaService;
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
