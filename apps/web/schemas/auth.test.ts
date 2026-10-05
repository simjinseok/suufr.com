import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { consentSchema, signupSchema } from './auth';

const base = {
  name: '홍길동',
  email: 'test@example.com',
  password: 'Password1!',
  passwordConfirm: 'Password1!',
};
const agreed = { agreeTerms: 'true', agreePrivacy: 'true', agreeOverseasTransfer: 'true' };

function fieldErrors(result: z.ZodSafeParseResult<unknown>) {
  if (result.success) return {};
  return z.flattenError(result.error).fieldErrors as Record<string, string[]>;
}

describe('signupSchema 동의 필드', () => {
  it("'true' 문자열 세 개가 모두 있으면 통과하고 불리언 true 로 변환된다", () => {
    const result = signupSchema.safeParse({ ...base, ...agreed });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.agreeTerms).toBe(true);
      expect(result.data.agreeOverseasTransfer).toBe(true);
    }
  });

  it("네이티브 체크박스 값 'on' 도 동의로 인식한다", () => {
    const result = signupSchema.safeParse({
      ...base,
      agreeTerms: 'on',
      agreePrivacy: 'on',
      agreeOverseasTransfer: 'on',
    });
    expect(result.success).toBe(true);
  });

  it('동의 키가 모두 누락되면 세 에러를 각 키에 보고한다', () => {
    const errors = fieldErrors(signupSchema.safeParse(base));
    expect(errors.agreeTerms).toEqual(['이용약관에 동의해주세요']);
    expect(errors.agreePrivacy).toEqual(['개인정보 수집·이용에 동의해주세요']);
    expect(errors.agreeOverseasTransfer).toEqual(['개인정보 국외 이전에 동의해주세요']);
  });

  it("'false' 는 미동의다", () => {
    const errors = fieldErrors(signupSchema.safeParse({ ...base, ...agreed, agreePrivacy: 'false' }));
    expect(Object.keys(errors)).toEqual(['agreePrivacy']);
  });

  it('모두 동의했지만 비밀번호가 불일치하면 passwordConfirm 에러만 보고한다', () => {
    const errors = fieldErrors(signupSchema.safeParse({ ...base, ...agreed, passwordConfirm: 'x' }));
    expect(errors).toEqual({ passwordConfirm: ['비밀번호가 일치하지 않습니다'] });
  });
});

describe('consentSchema (재동의)', () => {
  it('세 동의가 모두 있어야 통과한다', () => {
    expect(consentSchema.safeParse(agreed).success).toBe(true);
    expect(consentSchema.safeParse({ ...agreed, agreeOverseasTransfer: 'false' }).success).toBe(false);
  });
});
