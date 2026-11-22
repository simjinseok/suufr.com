import { APPLE_PRIVATE_RELAY_SUFFIX, DEFAULT_ORGANIZATION_NAME, UserProvisioningService } from './user-provisioning.service';

/** prisma 는 mock. 조직명 결정만 검증한다 */
function build(existing: object | null = null) {
  const tx = {
    organization: { create: vi.fn().mockResolvedValue({}) },
    userSettings: { upsert: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    organization: { findFirst: vi.fn().mockResolvedValue(existing) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { service: new UserProvisioningService(prisma as never), tx };
}

describe('UserProvisioningService.ensureOrganization', () => {
  it('이름이 있으면 릴레이 주소여도 그 이름을 조직명·프로필명으로 쓴다', async () => {
    const { service, tx } = build();
    await service.ensureOrganization('u1', `x7k2p9q4mz${APPLE_PRIVATE_RELAY_SUFFIX}`, ' 홍길동 ');
    expect(tx.organization.create).toHaveBeenCalledWith({ data: { name: '홍길동', userId: 'u1', profileName: '홍길동' } });
  });

  it('이름이 없으면 이메일 앞부분을 쓴다', async () => {
    const { service, tx } = build();
    await service.ensureOrganization('u1', 'teacher@example.com', '');
    expect(tx.organization.create).toHaveBeenCalledWith({ data: { name: 'teacher', userId: 'u1', profileName: 'teacher' } });
  });

  it.each(['x7k2p9q4mz@privaterelay.appleid.com', 'X7K2P9Q4MZ@PrivateRelay.AppleID.com'])(
    '이름이 없고 Apple 비공개 릴레이 주소면(%s) 무작위 앞부분 대신 고정 기본 이름을 쓴다',
    async (email) => {
      const { service, tx } = build();
      await service.ensureOrganization('u1', email, '  ');
      expect(DEFAULT_ORGANIZATION_NAME).toBe('내 스튜디오');
      expect(tx.organization.create).toHaveBeenCalledWith({ data: { name: DEFAULT_ORGANIZATION_NAME, userId: 'u1', profileName: DEFAULT_ORGANIZATION_NAME } });
    },
  );

  it('이미 조직이 있으면 아무것도 만들지 않는다', async () => {
    const { service, tx } = build({ id: 1 });
    await service.ensureOrganization('u1', 'teacher@example.com', '');
    expect(tx.organization.create).not.toHaveBeenCalled();
  });
});
