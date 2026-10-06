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
    const code = await service.create({ kind: 'session', sessionToken: 'tok', userId: 'u1' });
    expect(code.length).toBeGreaterThan(30);
    const stored = [...rows.values()][0]!;
    expect(stored.identifier.startsWith('social-handoff:')).toBe(true);
    expect(stored.identifier).not.toContain(code);

    await expect(service.consume(code)).resolves.toEqual({ kind: 'session', sessionToken: 'tok', userId: 'u1' });
    await expect(service.consume(code)).resolves.toBeNull();
  });

  it('만료된 코드는 삭제되고 null', async () => {
    const { service, rows } = makeService();
    const code = await service.create({ kind: 'mfa', cookiePairs: 'better-auth.two_factor=x.y' });
    [...rows.values()][0]!.expiresAt = new Date(Date.now() - 1000);
    await expect(service.consume(code)).resolves.toBeNull();
    expect(rows.size).toBe(0);
  });

  it('위조·빈 코드는 null', async () => {
    const { service } = makeService();
    await expect(service.consume('')).resolves.toBeNull();
    await expect(service.consume('nope')).resolves.toBeNull();
    await expect(service.consume('x'.repeat(200))).resolves.toBeNull();
  });
});
