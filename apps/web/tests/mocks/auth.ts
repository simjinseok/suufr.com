import { vi } from 'vitest';

export type MockUser = {
  id: string;
};

export type MockSession = {
  user: MockUser;
} | null;

let mockSession: MockSession = null;

export const mockGetSession = vi.fn(() => Promise.resolve(mockSession));

export function setMockSession(session: MockSession) {
  mockSession = session;
  mockGetSession.mockResolvedValue(session);
}

export function setMockUser(user: MockUser) {
  setMockSession({ user });
}

export function clearMockSession() {
  mockSession = { user: null } as unknown as MockSession;
  mockGetSession.mockResolvedValue({ user: null } as unknown as MockSession);
}
