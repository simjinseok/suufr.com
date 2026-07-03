import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { FastifyReply } from 'fastify';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      }
      else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) || exception.message;
        code = (resp.error as string) || this.getCodeFromStatus(status);
        details = resp.details;
      }

      // 5xx는 예상치 못한 서버 오류이므로 Sentry로 리포트 (4xx는 정상적인 클라이언트 오류라 제외)
      if (status >= 500) {
        Sentry.captureException(exception);
      }
    }
    else if (exception instanceof Error) {
      // 예상치 못한 내부 오류: 원문은 로그/Sentry에만 남기고 클라이언트엔 일반 메시지만 노출
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
      Sentry.captureException(exception);
    }

    const error: ErrorResponse['error'] = {
      code,
      message: Array.isArray(message) ? message.join(', ') : message,
    };

    if (details !== undefined) {
      error.details = details;
    }

    const errorResponse: ErrorResponse = {
      success: false,
      error,
    };

    response.status(status).send(errorResponse);
  }

  private getCodeFromStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'VALIDATION_ERROR';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}
