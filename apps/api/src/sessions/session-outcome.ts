import { BadRequestException } from '@nestjs/common';

export type OutcomeInput = { isDone?: boolean | null; isAbsent?: boolean | null };
export type OutcomeWrite = { isDone?: boolean; isAbsent?: boolean };

/**
 * 요청의 완료·결석 플래그를 DB에 쓸 값으로 바꾼다. 결석은 완료된 수업이라(isAbsent ⇒ isDone)
 * DB CHECK와 어긋나지 않게 한쪽만 와도 다른 쪽을 맞춘다.
 * 모순(isDone false + isAbsent true)이면 BadRequestException('결석은 완료된 수업에만 표시할 수 있습니다.')
 */
export function resolveOutcome(input: OutcomeInput): OutcomeWrite {
  const isDone = input.isDone ?? undefined;
  const isAbsent = input.isAbsent ?? undefined;

  if (isDone === false && isAbsent === true) {
    throw new BadRequestException('결석은 완료된 수업에만 표시할 수 있습니다.');
  }
  // 결석 표시는 완료도 함께 켠다
  if (isAbsent === true) return { isDone: true, isAbsent: true };
  // 예정으로 되돌리면 결석도 같이 꺼야 CHECK를 어기지 않는다
  if (isDone === false) return { isDone: false, isAbsent: false };

  const write: OutcomeWrite = {};
  if (isDone !== undefined) write.isDone = isDone;
  // 완료만 오면 결석 여부는 건드리지 않는다 (상태를 모르는 클라이언트의 저장이 결석을 지우지 않게)
  if (isAbsent !== undefined) write.isAbsent = isAbsent;
  return write;
}
