import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { SignupDto } from './signup.dto';

// main.ts 의 전역 ValidationPipe 와 동일한 옵션으로 검증한다
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});

const validConsents = {
  terms: true,
  privacy: true,
  overseasTransfer: true,
  termsVersion: '2026-07-08',
  privacyVersion: '2026-07-08',
};

const validBody = {
  name: '홍길동',
  email: 'test@example.com',
  password: 'Password1!',
  consents: validConsents,
};

async function validate(body: unknown) {
  return pipe.transform(body, { type: 'body', metatype: SignupDto });
}

async function expectRejected(body: unknown, messageIncludes?: string) {
  await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException);
  if (messageIncludes) {
    const error = await validate(body).catch(e => e as BadRequestException);
    const response = error.getResponse() as { message: string[] };
    expect(response.message.join(' ')).toContain(messageIncludes);
  }
}

describe('SignupDto', () => {
  it('세 동의가 모두 true 이면 통과하고 DTO 인스턴스로 변환된다', async () => {
    const dto = await validate(validBody);
    expect(dto).toBeInstanceOf(SignupDto);
    expect(dto.consents.overseasTransfer).toBe(true);
  });

  it('consents 가 없으면 거부된다', async () => {
    await expectRejected({ name: validBody.name, email: validBody.email, password: validBody.password });
  });

  it.each([
    ['terms', '이용약관'],
    ['privacy', '개인정보 수집·이용'],
    ['overseasTransfer', '국외 이전'],
  ])('%s 가 false 이면 해당 메시지로 거부된다', async (key, message) => {
    await expectRejected({ ...validBody, consents: { ...validConsents, [key]: false } }, message);
  });

  it('동의 값이 불리언이 아니면 거부된다', async () => {
    await expectRejected({ ...validBody, consents: { ...validConsents, terms: 'yes' } });
  });

  it('문서 버전이 YYYY-MM-DD 형식이 아니면 거부된다', async () => {
    await expectRejected({ ...validBody, consents: { ...validConsents, privacyVersion: '2026/07/08' } });
  });

  it('IP 는 형식을 검증하지 않고 길이만 제한한다', async () => {
    await expect(validate({ ...validBody, consents: { ...validConsents, ipAddress: 'not-an-ip' } })).resolves.toBeTruthy();
    await expectRejected({ ...validBody, consents: { ...validConsents, ipAddress: 'x'.repeat(46) } });
  });

  it('알 수 없는 키는 whitelist 로 거부된다', async () => {
    await expectRejected({ ...validBody, consents: { ...validConsents, marketing: true } });
    await expectRejected({ ...validBody, extra: 1 });
  });
});
