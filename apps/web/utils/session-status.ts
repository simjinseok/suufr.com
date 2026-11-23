export type SessionStatus = 'scheduled' | 'done' | 'absent';

export const SESSION_STATUSES: readonly SessionStatus[] = ['scheduled', 'done', 'absent'];

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  scheduled: '예정',
  done: '완료',
  absent: '결석',
};

// 결석은 수업한 것으로 처리하므로 끝난 수업이다
export function isFinished(status: SessionStatus): boolean {
  return status !== 'scheduled';
}
