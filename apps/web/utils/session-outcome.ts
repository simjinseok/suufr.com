// 수업 상태. 결석은 수업한 것으로 처리하므로 isDone이 참이면서 isAbsent도 참인 수업이다
export type SessionOutcome = 'scheduled' | 'done' | 'absent';

export const OUTCOME_LABEL: Record<SessionOutcome, string> = {
  scheduled: '예정',
  done: '완료',
  absent: '결석',
};

export function getSessionOutcome(s: { isDone: boolean; isAbsent: boolean }): SessionOutcome {
  if (!s.isDone) return 'scheduled';
  return s.isAbsent ? 'absent' : 'done';
}

// 상태를 바꿀 때는 두 플래그를 항상 함께 보낸다. isDone: true만 보내면 서버가 결석 여부를 그대로 둔다
export function outcomeToFlags(o: SessionOutcome): { isDone: boolean; isAbsent: boolean } {
  switch (o) {
    case 'scheduled':
      return { isDone: false, isAbsent: false };
    case 'done':
      return { isDone: true, isAbsent: false };
    case 'absent':
      return { isDone: true, isAbsent: true };
  }
}
