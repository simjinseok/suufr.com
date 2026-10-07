import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/generated/client';
import type { MailService } from '../../mail/mail.service';
import { createAuthOptions } from './auth.config';

describe('createAuthOptions', () => {
  const options = createAuthOptions({
    prisma: {} as PrismaClient,
    baseURL: 'http://localhost:4000',
    secret: 'test-secret',
    webUrl: 'http://localhost:3000',
    mail: { send: vi.fn() } as unknown as MailService,
    onUserCreated: vi.fn(),
  });

  it('비밀번호 재설정 시 기존 세션을 모두 폐기한다 (미인증 가입 세션이 계정 회수 후 살아남지 않도록)', () => {
    expect(options.emailAndPassword.revokeSessionsOnPasswordReset).toBe(true);
  });
});
