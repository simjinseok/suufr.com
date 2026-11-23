import { isFinished, type SessionStatus } from './session-status';

// 청구 파생 계산 (docs/schema-redesign.md §3) — 상태는 저장하지 않고 항상 계산한다
// 납부 상태는 청구가 아니라 학생 단위 잔액(서버 파생)으로 판정한다 — 여기엔 세션 축 계산만 남는다

// 수강권의 사용 회차: 끝난 수업(완료·결석)을 센다. 예정 세션은 아직 쓰지 않은 회차다
export function countDoneSessions(sessions: Array<{ status: SessionStatus }>): number {
  return sessions.filter(s => isFinished(s.status)).length;
}
