import { vi } from 'vitest';

// 서버 전용 모듈 가드 (vitest 에서는 패키지 해석 불가)
vi.mock('server-only', () => ({}));

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
  cookies: vi.fn(() =>
    Promise.resolve({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    }),
  ),
}));

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  withServerActionInstrumentation: vi.fn(
    (_name: string, _options: unknown, fn: () => unknown) => fn(),
  ),
}));

// Mock auth
vi.mock('@/utils/auth', async () => {
  const { mockGetSession } = await import('./mocks/auth');
  return { getSession: mockGetSession };
});
