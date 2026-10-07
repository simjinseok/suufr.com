import { vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, HttpException, InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';
import { APIError } from 'better-auth/api';
import { betterAuthErrorCode, toHttpException } from './better-auth-error.map';
import { MailDeliveryError } from '../../mail/mail.service';

function body(e: HttpException) {
  return e.getResponse() as { message: string; error: string };
}

describe('toHttpException', () => {
  it('알려진 코드는 상태와 한국어 메시지로 매핑된다', () => {
    const e = toHttpException(new APIError('UNAUTHORIZED', { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' }));
    expect(e).toBeInstanceOf(UnauthorizedException);
    expect(body(e)).toEqual({ message: '이메일 또는 비밀번호가 올바르지 않습니다', error: 'INVALID_EMAIL_OR_PASSWORD' });
  });

  it('403 EMAIL_NOT_VERIFIED → ForbiddenException', () => {
    const e = toHttpException(new APIError('FORBIDDEN', { code: 'EMAIL_NOT_VERIFIED', message: 'x' }));
    expect(e).toBeInstanceOf(ForbiddenException);
    expect(body(e).message).toBe('이메일 인증이 필요합니다');
  });

  it('코드 없는 401 은 세션 만료 메시지이고, 의도된 처리이므로 미매핑 경고를 남기지 않는다', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const e = toHttpException(new APIError('UNAUTHORIZED', { message: 'unauthorized' }));
    expect(e).toBeInstanceOf(UnauthorizedException);
    expect(body(e).message).toBe('세션이 만료되었습니다. 다시 로그인해주세요.');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('코드가 있지만 매핑되지 않은 401 은 경고를 남긴다', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    toHttpException(new APIError('UNAUTHORIZED', { code: 'SOMETHING_NEW', message: 'x' }));
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('422/409 → ConflictException, 429 → 429, 알 수 없는 4xx → BadRequest 일반 메시지', () => {
    expect(toHttpException(new APIError('UNPROCESSABLE_ENTITY', { code: 'USER_ALREADY_EXISTS', message: 'x' }))).toBeInstanceOf(ConflictException);
    const locked = toHttpException(new APIError('TOO_MANY_REQUESTS', { code: 'ACCOUNT_TEMPORARILY_LOCKED', message: 'x' }));
    expect(locked.getStatus()).toBe(429);
    const unknown = toHttpException(new APIError('BAD_REQUEST', { code: 'SOMETHING_NEW', message: 'x' }));
    expect(unknown).toBeInstanceOf(BadRequestException);
    expect(body(unknown)).toEqual({ message: '요청을 처리할 수 없습니다', error: 'SOMETHING_NEW' });
  });

  it('5xx 와 APIError 가 아닌 오류는 500 일반 메시지', () => {
    expect(toHttpException(new APIError('INTERNAL_SERVER_ERROR', { message: 'boom' }))).toBeInstanceOf(InternalServerErrorException);
    expect(toHttpException(new Error('boom'))).toBeInstanceOf(InternalServerErrorException);
  });

  it('이미 HttpException 이면 그대로 돌려준다', () => {
    const original = new BadRequestException('x');
    expect(toHttpException(original)).toBe(original);
  });

  it('betterAuthErrorCode 는 APIError 의 body.code 만 읽는다', () => {
    expect(betterAuthErrorCode(new APIError('BAD_REQUEST', { code: 'INVALID_OTP', message: 'x' }))).toBe('INVALID_OTP');
    expect(betterAuthErrorCode(new Error('x'))).toBeUndefined();
  });
});

describe('toHttpException — 메일 발송 실패', () => {
  it('MailDeliveryError 는 503 + MAIL_DELIVERY_FAILED 코드로 사용자에게 전달된다', () => {
    const exception = toHttpException(new MailDeliveryError('메일 발송 실패'));
    expect(exception.getStatus()).toBe(503);
    expect(exception.getResponse()).toMatchObject({ error: 'MAIL_DELIVERY_FAILED', message: expect.stringContaining('보내지 못했습니다') });
  });
});
