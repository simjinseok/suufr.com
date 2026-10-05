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

/** 기존 Cognito MFA 사용자에게 TOTP 재등록 안내 (Phase 5 배치) */
export function mfaReenrollMail(to: string, settingsUrl: string) {
  return renderMail({
    to,
    subject: '2단계 인증 재등록이 필요합니다',
    title: '2단계 인증을 다시 설정해주세요',
    paragraphs: [
      '스프의 로그인 시스템이 새로 바뀌어 기존 인증 앱 설정을 이어받을 수 없습니다.',
      '로그인 후 보안 설정에서 인증 앱을 다시 등록해주세요. 등록 전까지 2단계 인증 없이 로그인됩니다.',
      `보안 설정: ${settingsUrl}`,
    ],
    footer: '문의가 필요하면 이 메일에 회신해주세요.',
  });
}
