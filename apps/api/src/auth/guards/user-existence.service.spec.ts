import { USER_EXISTENCE_TTL_MS, UserExistenceService } from './user-existence.service';
import type { PrismaService } from '../../prisma/prisma.service';

const USER = '11111111-1111-4111-8111-111111111111';

function build(row: { id: string } | null = { id: USER }) {
  const findUnique = vi.fn().mockResolvedValue(row);
  const service = new UserExistenceService({ user: { findUnique } } as unknown as PrismaService);
  return { service, findUnique };
}

describe('UserExistenceService', () => {
  afterEach(() => vi.useRealTimers());

  it('있음은 TTL 동안 캐시하고, 지나면 다시 조회한다', async () => {
    vi.useFakeTimers();
    const { service, findUnique } = build();
    await expect(service.exists(USER)).resolves.toBe(true);
    await expect(service.exists(USER)).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: USER }, select: { id: true } });

    vi.advanceTimersByTime(USER_EXISTENCE_TTL_MS + 1);
    await service.exists(USER);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('없음은 캐시하지 않는다 (매번 조회)', async () => {
    const { service, findUnique } = build(null);
    await expect(service.exists(USER)).resolves.toBe(false);
    await expect(service.exists(USER)).resolves.toBe(false);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('invalidate 하면 TTL 안이라도 다시 조회해 삭제를 바로 반영한다', async () => {
    const { service, findUnique } = build();
    await service.exists(USER);
    findUnique.mockResolvedValue(null);
    service.invalidate(USER);
    await expect(service.exists(USER)).resolves.toBe(false);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });
});
