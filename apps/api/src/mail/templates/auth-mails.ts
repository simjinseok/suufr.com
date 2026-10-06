import { renderMail } from './layout';

const OTP_MINUTES = 5;

/** 가입 이메일 인증 코드 (better-auth emailOTP type=email-verification) */
export function verifyEmailMail(to: string, otp: string) {
  return renderMail({
    to,
    subject: '이메일 인증 코드',
    title: '이메일 인증을 완료해주세요',
    paragraphs: [
      '아래 6자리 인증 코드를 가입 화면에 입력하면 이메일 인증이 완료됩니다.',
      `코드는 ${OTP_MINUTES}분 동안만 유효합니다.`,
    ],
    highlight: otp,
  });
}

/** 비밀번호 재설정 코드 (better-auth emailOTP type=forget-password) */
export function resetPasswordMail(to: string, otp: string) {
  return renderMail({
    to,
    subject: '비밀번호 재설정 코드',
    title: '비밀번호를 재설정합니다',
    paragraphs: [
      '아래 6자리 코드를 비밀번호 재설정 화면에 입력한 뒤 새 비밀번호를 설정해주세요.',
      `코드는 ${OTP_MINUTES}분 동안만 유효합니다.`,
    ],
    highlight: otp,
    footer: '본인이 요청하지 않았다면 비밀번호는 바뀌지 않으니 이 메일을 무시하셔도 됩니다.',
  });
}

/** 이미 가입된 이메일로 가입 시도가 있었음을 알림 (열거 방지 응답과 짝) */
export function existingUserSignupAttemptMail(to: string) {
  return renderMail({
    to,
    subject: '이미 가입된 이메일입니다',
    title: '이 이메일로 가입 시도가 있었습니다',
    paragraphs: [
      '이 주소는 이미 스프에 가입되어 있어 새 계정을 만들지 않았습니다.',
      '본인이라면 로그인해주세요. 비밀번호를 잊었다면 로그인 화면의 "비밀번호를 잊으셨나요?"를 이용하세요.',
    ],
  });
}
