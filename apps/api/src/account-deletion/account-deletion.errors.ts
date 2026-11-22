import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 계정 삭제 오류 코드. 응답은 기존 관례대로 { message(한국어, 그대로 사용자에게 보여줄 문장), error(코드) } 이고
 * HttpExceptionFilter 가 { success: false, error: { code, message } } 로 감싼다.
 * 재인증 실패는 401 이 아니라 400 이다 — 클라이언트는 401 을 세션 만료로 보고 로그아웃 처리하기 때문.
 */
export const ACCOUNT_DELETE_ERRORS = {
  ACCOUNT_DELETE_INVALID_PASSWORD: { status: HttpStatus.BAD_REQUEST, message: '비밀번호가 올바르지 않습니다' },
  ACCOUNT_DELETE_INVALID_OTP: { status: HttpStatus.BAD_REQUEST, message: '인증코드가 올바르지 않습니다' },
  ACCOUNT_DELETE_OTP_EXPIRED: { status: HttpStatus.BAD_REQUEST, message: '인증코드가 만료되었습니다. 코드를 다시 받아주세요.' },
  ACCOUNT_DELETE_OTP_TOO_MANY_ATTEMPTS: { status: HttpStatus.BAD_REQUEST, message: '인증 시도 횟수를 초과했습니다. 코드를 다시 받아주세요.' },
  ACCOUNT_DELETE_REAUTH_REQUIRED: { status: HttpStatus.BAD_REQUEST, message: '본인 확인이 필요합니다' },
  ACCOUNT_DELETE_IN_PROGRESS: { status: HttpStatus.CONFLICT, message: '계정 삭제가 이미 진행 중입니다. 잠시 후 다시 확인해주세요.' },
  ACCOUNT_DELETE_SUBSCRIPTION_CANCEL_FAILED: { status: HttpStatus.BAD_GATEWAY, message: '구독을 해지하지 못해 계정을 삭제하지 않았습니다. 잠시 후 다시 시도해주세요.' },
  ACCOUNT_DELETE_UNSUPPORTED_PROVIDER: { status: HttpStatus.BAD_REQUEST, message: '이 로그인 방식으로 연결된 계정은 앱에서 삭제할 수 없습니다. support@suufr.com으로 요청해주세요.' },
} as const;

export type AccountDeleteErrorCode = keyof typeof ACCOUNT_DELETE_ERRORS;

/** @param message 기본 문구 대신 보여줄 문장 (예: 재인증 수단별 안내) */
export function accountDeleteError(code: AccountDeleteErrorCode, message?: string): HttpException {
  const { status, message: defaultMessage } = ACCOUNT_DELETE_ERRORS[code];
  return new HttpException({ message: message ?? defaultMessage, error: code }, status);
}
