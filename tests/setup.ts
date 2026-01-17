import { vi } from 'vitest';

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

// Mock prisma
vi.mock('@/utils/prisma', async () => {
  const { prismaMock } = await import('./mocks/prisma');
  return { default: prismaMock };
});

// Mock auth
vi.mock('@/utils/auth', async () => {
  const { mockGetSession } = await import('./mocks/auth');
  return { getSession: mockGetSession };
});
