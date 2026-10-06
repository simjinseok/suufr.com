import { MailDeliveryError, MailService } from './mail.service';

vi.mock('@sentry/nestjs', () => ({ captureException: vi.fn() }));

function build(env: Record<string, string>) {
  const config = { get: (key: string) => env[key] } as never;
  const service = new MailService(config);
  const send = vi.fn();
  (service as unknown as { client: { send: typeof send } }).client = { send };
  return { service, send };
}

const message = { to: 'a@b.c', subject: 's', html: '<p>h</p>', text: 't' };
const sesEnv = { MAIL_TRANSPORT: 'ses', MAIL_FROM_ADDRESS: 'no-reply@suufr.com', AWS_SES_REGION: 'ap-northeast-1' };

describe('MailService', () => {
  it('sendOrThrow: SES 호출이 실패하면 MailDeliveryError 를 던진다', async () => {
    const { service, send } = build(sesEnv);
    send.mockRejectedValue(new Error('AccessDeniedException'));
    await expect(service.sendOrThrow(message)).rejects.toBeInstanceOf(MailDeliveryError);
  });

  it('sendOrThrow: 성공하면 아무것도 던지지 않는다', async () => {
    const { service, send } = build(sesEnv);
    send.mockResolvedValue({});
    await expect(service.sendOrThrow(message)).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('send: 실패를 삼킨다 (알림성 메일용)', async () => {
    const { service, send } = build(sesEnv);
    send.mockRejectedValue(new Error('boom'));
    await expect(service.send(message)).resolves.toBeUndefined();
  });

  it('log 전송에서는 SES 를 호출하지 않고 성공한다', async () => {
    const { service, send } = build({ MAIL_TRANSPORT: 'log' });
    await expect(service.sendOrThrow(message)).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });
});
