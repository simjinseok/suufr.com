import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { APIError } from 'better-auth/api';

const logger = new Logger('BetterAuth');

/** better-auth 에러 코드 → 한국어 메시지 (CognitoService 의 문구를 승계해 web 변경 없음) */
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: '이메일 또는 비밀번호가 올바르지 않습니다',
  CREDENTIAL_ACCOUNT_NOT_FOUND: '이메일 또는 비밀번호가 올바르지 않습니다',
  USER_NOT_FOUND: '이메일 또는 비밀번호가 올바르지 않습니다',
  INVALID_PASSWORD: '이메일 또는 비밀번호가 올바르지 않습니다',
  EMAIL_NOT_VERIFIED: '이메일 인증이 필요합니다',
  USER_ALREADY_EXISTS: '이미 가입된 이메일입니다',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: '이미 가입된 이메일입니다',
  PASSWORD_TOO_SHORT: '비밀번호는 8자 이상이어야 합니다',
  PASSWORD_TOO_LONG: '비밀번호는 128자 이하여야 합니다',
  INVALID_EMAIL: '유효한 이메일을 입력해주세요',
  INVALID_OTP: '인증코드가 올바르지 않습니다',
  OTP_EXPIRED: '인증코드가 만료되었습니다. 다시 발송해주세요.',
  TOO_MANY_ATTEMPTS: '인증 시도 횟수를 초과했습니다. 코드를 다시 발송해주세요.',
  INVALID_CODE: '인증코드가 올바르지 않습니다',
  INVALID_TWO_FACTOR_CODE: 'MFA 코드가 올바르지 않습니다',
  INVALID_BACKUP_CODE: '백업코드가 올바르지 않습니다',
  TOTP_NOT_ENABLED: '2단계 인증이 설정되어 있지 않습니다',
  TOTP_ALREADY_ENABLED: '2단계 인증이 이미 설정되어 있습니다. 해제 후 다시 등록해주세요.',
  TWO_FACTOR_NOT_ENABLED: '2단계 인증이 설정되어 있지 않습니다',
  ACCOUNT_TEMPORARILY_LOCKED: '인증 실패가 반복되어 계정이 잠시 잠겼습니다. 15분 후 다시 시도해주세요.',
  INVALID_TWO_FACTOR_COOKIE: 'MFA 세션이 만료되었습니다. 다시 로그인해주세요.',
  SESSION_EXPIRED: '세션이 만료되었습니다. 다시 로그인해주세요.',
  FAILED_TO_CREATE_SESSION: '로그인에 실패했습니다',
  COGNITO_USER_NOT_CONFIRMED: '이메일 인증이 필요합니다',
  COGNITO_NEW_PASSWORD_REQUIRED: '새 비밀번호 설정이 필요합니다',
};

export function isBetterAuthError(error: unknown): error is APIError {
  return error instanceof APIError;
}

export function betterAuthErrorCode(error: unknown): string | undefined {
  if (!isBetterAuthError(error)) return undefined;
  const body = error.body as { code?: string } | undefined;
  return body?.code;
}

/**
 * APIError → NestJS HttpException. 응답 형식은 기존 HttpExceptionFilter 가 처리한다.
 * 매핑되지 않은 4xx 는 코드와 함께 일반 메시지로, 5xx 는 로그 후 500.
 */
export function toHttpException(error: unknown): HttpException {
  if (error instanceof HttpException) return error;

  if (!isBetterAuthError(error)) {
    logger.error('better-auth 호출 중 알 수 없는 오류', error instanceof Error ? error.stack : String(error));
    return new InternalServerErrorException('인증 처리 중 오류가 발생했습니다');
  }

  const code = betterAuthErrorCode(error);
  const message = (code && MESSAGES[code]) || '요청을 처리할 수 없습니다';
  const payload = { message, error: code ?? 'AUTH_ERROR' };

  if (!code || !MESSAGES[code]) {
    logger.warn(`매핑되지 않은 better-auth 에러: ${error.statusCode} ${code ?? error.message}`);
  }

  switch (error.statusCode) {
    case HttpStatus.UNAUTHORIZED:
      // 코드 없는 401 은 세션 토큰 만료/폐기 (getToken, signOut 등)
      return new UnauthorizedException(code && MESSAGES[code] ? payload : { message: MESSAGES.SESSION_EXPIRED, error: code ?? 'SESSION_EXPIRED' });
    case HttpStatus.FORBIDDEN:
      return new ForbiddenException(payload);
    case HttpStatus.CONFLICT:
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return new ConflictException(payload);
    case HttpStatus.TOO_MANY_REQUESTS:
      return new HttpException(payload, HttpStatus.TOO_MANY_REQUESTS);
    default:
      if (error.statusCode >= 500) {
        logger.error(`better-auth 서버 오류: ${error.statusCode} ${error.message}`, error.stack);
        return new InternalServerErrorException('인증 처리 중 오류가 발생했습니다');
      }
      return new BadRequestException(payload);
  }
}
