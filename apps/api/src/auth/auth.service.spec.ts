import { AuthService } from './auth.service';

function build(user: { twoFactorEnabled: boolean | null; emailVerified: boolean } | null, credential: { id: string } | null) {
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(user) },
    account: { findFirst: vi.fn().mockResolvedValue(credential) },
  };
  return { service: new AuthService(prisma as never), prisma };
}

describe('AuthService.getSecurityStatus', () => {
  it('hasPassword: 비밀번호가 있는 credential 계정이 있으면 true', async () => {
    const { service, prisma } = build({ twoFactorEnabled: true, emailVerified: true }, { id: 'acc-1' });
    await expect(service.getSecurityStatus('u1')).resolves.toEqual({ twoFactorEnabled: true, emailVerified: true, hasPassword: true });
    expect(prisma.account.findFirst).toHaveBeenCalledWith({
      where: { userId: 'u1', providerId: 'credential', password: { not: null } },
      select: { id: true },
    });
  });

  it('hasPassword: Google 전용(또는 비밀번호가 지워진) 계정이면 false', async () => {
    const { service } = build({ twoFactorEnabled: null, emailVerified: true }, null);
    await expect(service.getSecurityStatus('u1')).resolves.toEqual({ twoFactorEnabled: false, emailVerified: true, hasPassword: false });
  });
});
