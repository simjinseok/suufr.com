import { z } from 'zod';

// 비밀번호 정책 — 8자 이상, 대문자·소문자·숫자·특수문자. apps/api/src/auth/dto/password-policy.ts 와 동일 규칙
export const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,128}$/;
export const PASSWORD_POLICY_MESSAGE = '비밀번호는 8자 이상이며 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다';

export const newPasswordField = z
  .string()
  .min(8, { error: '비밀번호는 8자 이상이어야 합니다' })
  .regex(PASSWORD_POLICY, { error: PASSWORD_POLICY_MESSAGE });

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

// 가입·재동의 공용 동의 2종 (모두 필수)
export const consentFields = {
  agreeTerms: consentField('이용약관에 동의해주세요'),
  agreePrivacy: consentField('개인정보 수집·이용에 동의해주세요'),
};

export const consentSchema = z.object(consentFields);

export const signupSchema = z
  .object({
    name: z.string().min(1, { error: '이름을 입력해주세요' }),
    email: z.string().email({ error: '유효한 이메일을 입력해주세요' }),
    password: newPasswordField,
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
    password: newPasswordField,
    passwordConfirm: z.string(),
  })
  .refine(data => data.password === data.passwordConfirm, {
    error: '비밀번호가 일치하지 않습니다',
    path: ['passwordConfirm'],
  });

// 로그인 2단계: 인증 앱 6자리 코드 또는 백업코드
export const mfaSchema = z.object({
  code: z
    .string()
    .trim()
    .min(6, { error: '인증 앱 코드(6자리) 또는 백업코드를 입력해주세요' })
    .max(32, { error: '코드가 너무 깁니다' }),
});

export const twoFactorPasswordSchema = z.object({
  password: z.string().min(8, { error: '비밀번호를 입력해주세요' }),
});

export const twoFactorCodeSchema = z.object({
  code: z.string().trim().length(6, { error: '인증 앱의 6자리 코드를 입력해주세요' }),
});
