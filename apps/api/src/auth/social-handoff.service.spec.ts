import { SocialHandoffService } from './social-handoff.service';
import type { PrismaService } from '../prisma/prisma.service';

function makeService() {
  const rows = new Map<string, { id: string; identifier: string; value: string; expiresAt: Date }>();
  const prisma = {
    verification: {
      create: vi.fn(async ({ data }: { data: { id: string; identifier: string; value: string; expiresAt: Date } }) => {
        rows.set(data.identifier, data);
        return data;
      }),
      findFirst: vi.fn(async ({ where }: { where: { identifier: string } }) => rows.get(where.identifier) ?? null),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        for (const [k, v] of rows) if (v.id === where.id) rows.delete(k);
      }),
    },
  } as unknown as PrismaService;
  return { service: new SocialHandoffService(prisma), rows, prisma };
}

describe('SocialHandoffService', () => {
  it('코드를 해시로 저장하고 한 번만 교환할 수 있다', async () => {
    const { service, rows } = makeService();
    const code = await service.create({ sessionToken: 'tok', userId: 'u1' });
    expect(code.length).toBeGreaterThan(30);
    const stored = [...rows.values()][0]!;
    expect(stored.identifier.startsWith('social-handoff:')).toBe(true);
    expect(stored.identifier).not.toContain(code);

    await expect(service.consume(code)).resolves.toEqual({ sessionToken: 'tok', userId: 'u1' });
    await expect(service.consume(code)).resolves.toBeNull();
  });

  it('만료된 코드는 삭제되고 null', async () => {
    const { service, rows } = makeService();
    const code = await service.create({ sessionToken: 'tok2', userId: 'u2' });
    [...rows.values()][0]!.expiresAt = new Date(Date.now() - 1000);
    await expect(service.consume(code)).resolves.toBeNull();
    expect(rows.size).toBe(0);
  });

  it('코드는 발급 후 3분 동안만 교환할 수 있다', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-08T00:00:00Z') });
    try {
      const { service } = makeService();
      const inTime = await service.create({ sessionToken: 'tok3', userId: 'u3' });
      const late = await service.create({ sessionToken: 'tok4', userId: 'u4' });

      vi.setSystemTime(new Date('2026-10-08T00:02:59Z'));
      await expect(service.consume(inTime)).resolves.toEqual({ sessionToken: 'tok3', userId: 'u3' });
      vi.setSystemTime(new Date('2026-10-08T00:03:01Z'));
      await expect(service.consume(late)).resolves.toBeNull();
    }
    finally {
      vi.useRealTimers();
    }
  });

  it('빈 코드와 128자를 넘는 코드는 DB 를 조회하지 않고 null, 발급하지 않은 코드도 null', async () => {
    const { service, prisma } = makeService();
    await expect(service.consume('')).resolves.toBeNull();
    await expect(service.consume('x'.repeat(129))).resolves.toBeNull();
    expect(prisma.verification.findFirst).not.toHaveBeenCalled();

    await expect(service.consume('nope')).resolves.toBeNull();
    expect(prisma.verification.findFirst).toHaveBeenCalledTimes(1);
  });
});
