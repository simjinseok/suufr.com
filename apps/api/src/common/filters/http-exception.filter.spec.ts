import { BadRequestException, HttpStatus, UnauthorizedException, type ArgumentsHost } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { HttpExceptionFilter } from './http-exception.filter';

function run(exception: unknown) {
  const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };
  const host = { switchToHttp: () => ({ getResponse: () => reply }) } as unknown as ArgumentsHost;
  new HttpExceptionFilter().catch(exception, host);
  return { status: reply.status.mock.calls[0]?.[0] as number, body: reply.send.mock.calls[0]?.[0] as { error: { code: string; message: string } } };
}

describe('HttpExceptionFilter', () => {
  it('레이트리밋(429)은 한국어 안내와 TOO_MANY_REQUESTS 코드로 응답한다 (문자열 응답 예외)', () => {
    const { status, body } = run(new ThrottlerException());
    expect(status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(body.error.message).toBe('요청이 너무 많습니다. 잠시 후 다시 시도해주세요');
  });

  it('ValidationPipe 의 400 은 Nest 기본 error 문구("Bad Request") 대신 BAD_REQUEST 코드를 쓴다 (iOS 가 이 코드를 안다)', () => {
    const { status, body } = run(new BadRequestException({ statusCode: 400, message: ['이메일을 입력해주세요'], error: 'Bad Request' }));
    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.message).toBe('이메일을 입력해주세요');
  });

  it('{ message, error: CODE } 형태는 코드를 그대로 쓴다', () => {
    const { body } = run(new UnauthorizedException({ message: '세션이 만료되었습니다', error: 'SESSION_EXPIRED' }));
    expect(body.error).toEqual({ code: 'SESSION_EXPIRED', message: '세션이 만료되었습니다' });
  });

  it('문자열 메시지 예외는 상태코드 기반 코드를 쓴다', () => {
    const { body } = run(new UnauthorizedException('세션 토큰이 필요합니다'));
    expect(body.error).toEqual({ code: 'UNAUTHORIZED', message: '세션 토큰이 필요합니다' });
  });
});
