import { BadRequestException } from '@nestjs/common';
import { resolveOutcome } from './session-outcome';

describe('resolveOutcome', () => {
  it('둘 다 없으면 아무것도 쓰지 않는다', () => {
    expect(resolveOutcome({})).toStrictEqual({});
  });

  it('isDone false만 오면 결석도 끈다', () => {
    expect(resolveOutcome({ isDone: false })).toStrictEqual({ isDone: false, isAbsent: false });
  });

  it('isDone true만 오면 결석 여부는 그대로 둔다', () => {
    expect(resolveOutcome({ isDone: true })).toStrictEqual({ isDone: true });
  });

  it('isAbsent true만 오면 완료도 켠다', () => {
    expect(resolveOutcome({ isAbsent: true })).toStrictEqual({ isDone: true, isAbsent: true });
  });

  it('isDone true와 isAbsent true면 둘 다 켠다', () => {
    expect(resolveOutcome({ isDone: true, isAbsent: true })).toStrictEqual({ isDone: true, isAbsent: true });
  });

  it('isDone false와 isAbsent true는 모순이라 400', () => {
    expect(() => resolveOutcome({ isDone: false, isAbsent: true })).toThrow(BadRequestException);
    expect(() => resolveOutcome({ isDone: false, isAbsent: true })).toThrow('결석은 완료된 수업에만 표시할 수 있습니다.');
  });

  it('isAbsent false만 오면 결석만 끈다', () => {
    expect(resolveOutcome({ isAbsent: false })).toStrictEqual({ isAbsent: false });
  });

  it('isDone true와 isAbsent false면 완료로 두고 결석을 끈다', () => {
    expect(resolveOutcome({ isDone: true, isAbsent: false })).toStrictEqual({ isDone: true, isAbsent: false });
  });

  it('isDone false와 isAbsent false면 둘 다 끈다', () => {
    expect(resolveOutcome({ isDone: false, isAbsent: false })).toStrictEqual({ isDone: false, isAbsent: false });
  });

  it('undefined 입력은 없음으로 본다', () => {
    expect(resolveOutcome({ isDone: undefined, isAbsent: undefined })).toStrictEqual({});
    expect(resolveOutcome({ isDone: true, isAbsent: undefined })).toStrictEqual({ isDone: true });
  });

  it('null 입력은 없음으로 본다', () => {
    expect(resolveOutcome({ isDone: null, isAbsent: null })).toStrictEqual({});
    expect(resolveOutcome({ isDone: false, isAbsent: null })).toStrictEqual({ isDone: false, isAbsent: false });
    expect(resolveOutcome({ isDone: null, isAbsent: true })).toStrictEqual({ isDone: true, isAbsent: true });
    expect(resolveOutcome({ isDone: null, isAbsent: false })).toStrictEqual({ isAbsent: false });
  });
});
