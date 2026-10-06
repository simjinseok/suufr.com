import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

/** 발송 실패. 사용자에게 보여줄 수 있는 실패라 better-auth 에러 매핑에서 503 으로 변환된다 */
export class MailDeliveryError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'MailDeliveryError';
  }
}

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * 인증/재설정 메일 발송 (Cognito 가 보내던 메일을 대체).
 * MAIL_TRANSPORT=ses  → SES v2. 발신 자격증명은 Phase 0 에서 확인한 SES 인증 도메인/주소.
 * MAIL_TRANSPORT=log  → 콘솔 출력 (로컬/스테이징). 운영에서 ses 가 아니면 기동 시 경고.
 *
 * - sendOrThrow: 사용자가 메일을 기다려야 하는 발송(인증코드·재설정코드). 실패하면 MailDeliveryError 를 던져
 *   호출자가 사용자에게 "보내지 못했다"고 알릴 수 있게 한다.
 * - send: 사용자가 기다리지 않는 알림성 발송. 실패는 로그·Sentry 로만 남기고 삼킨다.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: 'ses' | 'log';
  private readonly from: string;
  private readonly replyTo?: string;
  private client?: SESv2Client;

  constructor(private readonly config: ConfigService) {
    this.transport = this.config.get<string>('MAIL_TRANSPORT') === 'ses' ? 'ses' : 'log';
    const address = this.config.get<string>('MAIL_FROM_ADDRESS') ?? 'no-reply@localhost';
    const name = this.config.get<string>('MAIL_FROM_NAME');
    this.from = name ? `${name} <${address}>` : address;
    this.replyTo = this.config.get<string>('MAIL_REPLY_TO') || undefined;

    if (this.transport === 'ses') {
      const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
      const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
      this.client = new SESv2Client({
        region: this.config.get<string>('AWS_SES_REGION') || this.config.get<string>('AWS_REGION') || 'ap-northeast-2',
        // 전용 키가 없으면 기본 자격증명 체인(IAM 역할 등)
        ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
      });
    }
    else if (process.env.NODE_ENV === 'production') {
      this.logger.warn('MAIL_TRANSPORT 가 ses 가 아닙니다 — 운영에서 인증 메일이 발송되지 않습니다');
    }
  }

  /** 실패를 던지지 않는다. 호출자는 void 로 호출한다. */
  async send(message: MailMessage): Promise<void> {
    try {
      await this.sendOrThrow(message);
    }
    catch {
      // sendOrThrow 가 이미 로그·Sentry 처리
    }
  }

  /** 실패하면 MailDeliveryError. 로그·Sentry 는 여기서 남긴다. */
  async sendOrThrow(message: MailMessage): Promise<void> {
    if (this.transport === 'log' || !this.client) {
      this.logger.log(`[mail:log] to=${message.to} subject=${message.subject}\n${message.text}`);
      return;
    }
    try {
      await this.client.send(new SendEmailCommand({
        FromEmailAddress: this.from,
        Destination: { ToAddresses: [message.to] },
        ...(this.replyTo ? { ReplyToAddresses: [this.replyTo] } : {}),
        Content: {
          Simple: {
            Subject: { Data: message.subject, Charset: 'UTF-8' },
            Body: {
              Html: { Data: message.html, Charset: 'UTF-8' },
              Text: { Data: message.text, Charset: 'UTF-8' },
            },
          },
        },
      }));
    }
    catch (error) {
      this.logger.error(`메일 발송 실패 (to=${message.to}, subject=${message.subject})`, error instanceof Error ? error.stack : String(error));
      Sentry.captureException(error, { extra: { subject: message.subject } });
      throw new MailDeliveryError(`메일 발송 실패: ${message.subject}`, error);
    }
  }
}
