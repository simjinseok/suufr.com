import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { ForgotPasswordDto, ResetPasswordDto } from './password.dto';
import { PASSWORD_POLICY_MESSAGE } from './password-policy';

// main.ts 의 전역 ValidationPipe 와 동일한 옵션으로 검증한다
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});

async function expectRejected(metatype: typeof ForgotPasswordDto | typeof ResetPasswordDto, body: unknown, messageIncludes: string) {
  const error = await pipe.transform(body, { type: 'body', metatype }).catch(e => e as BadRequestException);
  expect(error).toBeInstanceOf(BadRequestException);
  expect((error.getResponse() as { message: string[] }).message.join(' ')).toContain(messageIncludes);
}

describe('ResetPasswordDto', () => {
  const validBody = { email: 'test@example.com', code: '123456', password: 'Password1!' };

  it('정책을 만족하면 통과한다', async () => {
    await expect(pipe.transform(validBody, { type: 'body', metatype: ResetPasswordDto })).resolves.toBeInstanceOf(ResetPasswordDto);
  });

  it('새 비밀번호도 가입과 같은 정책으로 거부된다 (재설정으로 약한 비밀번호를 만들 수 없다)', async () => {
    await expectRejected(ResetPasswordDto, { ...validBody, password: 'password' }, PASSWORD_POLICY_MESSAGE);
  });

  it('이메일 형식이 아니면 거부된다', async () => {
    await expectRejected(ResetPasswordDto, { ...validBody, email: 'not-an-email' }, '유효한 이메일을 입력해주세요');
  });
});

describe('ForgotPasswordDto', () => {
  it('이메일 형식이 아니면 거부된다', async () => {
    await expectRejected(ForgotPasswordDto, { email: 'not-an-email' }, '유효한 이메일을 입력해주세요');
  });
});
