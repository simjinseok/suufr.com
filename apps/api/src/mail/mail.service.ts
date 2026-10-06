import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

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
 * 호출자는 타이밍 공격 방지를 위해 발송을 await 하지 않는다(better-auth 권고). 실패는 여기서 로그·Sentry 로만 남긴다.
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
      if (this.transport === 'log' || !this.client) {
        this.logger.log(`[mail:log] to=${message.to} subject=${message.subject}\n${message.text}`);
        return;
      }
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
    }
  }
}
