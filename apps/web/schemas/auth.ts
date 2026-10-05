import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email({ error: '유효한 이메일을 입력해주세요' }),
  password: z.string().min(8, { error: '비밀번호는 8자 이상이어야 합니다' }),
});

// 체크박스 동의 필드. FormData 는 문자열이므로('on' | 'true' | 누락) 불리언으로 전처리한 뒤 true 만 허용한다.
const consentField = (message: string) =>
  z.preprocess(
    value => value === true || value === 'true' || value === 'on',
    z.literal(true, { error: message }),
  );

// 가입·재동의 공용 동의 3종 (모두 필수)
export const consentFields = {
  agreeTerms: consentField('이용약관에 동의해주세요'),
  agreePrivacy: consentField('개인정보 수집·이용에 동의해주세요'),
  agreeOverseasTransfer: consentField('개인정보 국외 이전에 동의해주세요'),
};

export const consentSchema = z.object(consentFields);

export const signupSchema = z
  .object({
    name: z.string().min(1, { error: '이름을 입력해주세요' }),
    email: z.string().email({ error: '유효한 이메일을 입력해주세요' }),
    password: z.string().min(8, { error: '비밀번호는 8자 이상이어야 합니다' }),
    passwordConfirm: z.string(),
    ...consentFields,
  })
  .refine(data => data.password === data.passwordConfirm, {
    error: '비밀번호가 일치하지 않습니다',
    path: ['passwordConfirm'],
  });

export const verifyEmailSchema = z.object({
  email: z.string().email({ error: '유효한 이메일을 입력해주세요' }),
  code: z.string().length(6, { error: '인증코드는 6자리입니다' }),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email({ error: '유효한 이메일을 입력해주세요' }),
});

export const resetPasswordSchema = z
  .object({
    email: z.string().email({ error: '유효한 이메일을 입력해주세요' }),
    code: z.string().length(6, { error: '인증코드는 6자리입니다' }),
    password: z.string().min(8, { error: '비밀번호는 8자 이상이어야 합니다' }),
    passwordConfirm: z.string(),
  })
  .refine(data => data.password === data.passwordConfirm, {
    error: '비밀번호가 일치하지 않습니다',
    path: ['passwordConfirm'],
  });

export const mfaSchema = z.object({
  code: z.string().length(6, { error: 'MFA 코드는 6자리입니다' }),
});

export const newPasswordSchema = z
  .object({
    password: z.string().min(8, { error: '비밀번호는 8자 이상이어야 합니다' }),
    passwordConfirm: z.string(),
  })
  .refine(data => data.password === data.passwordConfirm, {
    error: '비밀번호가 일치하지 않습니다',
    path: ['passwordConfirm'],
  });
