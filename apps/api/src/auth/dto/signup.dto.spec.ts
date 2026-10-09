import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { SignupDto } from './signup.dto';
import { PASSWORD_POLICY_MESSAGE } from './password-policy';

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
  termsVersion: '2026-07-08',
  privacyVersion: '2026-07-08',
};

const validBody = {
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
  it('두 동의가 모두 true 이면 통과하고 DTO 인스턴스로 변환된다', async () => {
    const dto = await validate(validBody);
    expect(dto).toBeInstanceOf(SignupDto);
    expect(dto.consents.privacy).toBe(true);
  });

  it('name 은 선택이다 (보내면 그대로 받는다)', async () => {
    const dto = await validate({ ...validBody, name: '홍길동' });
    expect(dto.name).toBe('홍길동');
  });

  it('이메일 형식이 아니면 거부된다', async () => {
    await expectRejected({ ...validBody, email: 'not-an-email' }, '유효한 이메일을 입력해주세요');
  });

  // better-auth 는 길이만 검사하므로 복잡도는 이 DTO 가 유일한 방어선이다 (iOS 는 web zod 를 거치지 않는다)
  it.each([
    ['대문자 없음', 'password1!'],
    ['소문자 없음', 'PASSWORD1!'],
    ['숫자 없음', 'Password!!'],
    ['특수문자 없음', 'Password12'],
    ['공백은 특수문자로 치지 않음', 'Password1 '],
    ['7자', 'Pass1!a'],
    ['129자', 'Aa1!' + 'x'.repeat(125)],
  ])('비밀번호 정책 위반(%s)이면 정책 메시지로 거부된다', async (_label, password) => {
    await expectRejected({ ...validBody, password }, PASSWORD_POLICY_MESSAGE);
  });

  it('비밀번호 길이 경계 8자·128자는 통과한다', async () => {
    await expect(validate({ ...validBody, password: 'Pass1!ab' })).resolves.toBeTruthy();
    await expect(validate({ ...validBody, password: 'Aa1!' + 'x'.repeat(124) })).resolves.toBeTruthy();
  });

  it('consents 가 없으면 거부된다', async () => {
    await expectRejected({ email: validBody.email, password: validBody.password });
  });

  it.each([
    ['terms', '이용약관'],
    ['privacy', '개인정보 수집·이용'],
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

  it('recaptchaToken 은 선택이며 문자열이면 통과한다', async () => {
    await expect(validate(validBody)).resolves.toBeTruthy();
    const dto = await validate({ ...validBody, recaptchaToken: 'tok' });
    expect(dto.recaptchaToken).toBe('tok');
  });

  it('recaptchaToken 이 4096자를 넘으면 거부된다', async () => {
    await expectRejected({ ...validBody, recaptchaToken: 'x'.repeat(4097) });
  });
});
