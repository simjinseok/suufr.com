import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { UpdateSettingsDto } from './update-settings.dto';

// main.ts 의 전역 ValidationPipe 와 동일한 옵션으로 검증한다
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});

async function validate(body: unknown) {
  return pipe.transform(body, { type: 'body', metatype: UpdateSettingsDto });
}

describe('UpdateSettingsDto.defaultPaymentMethod', () => {
  it.each(['transfer', 'card', 'cash'])('%s 는 통과한다', async (method) => {
    const dto = await validate({ defaultPaymentMethod: method });
    expect(dto.defaultPaymentMethod).toBe(method);
  });

  it('생략하면 통과한다 (부분 업데이트)', async () => {
    const dto = await validate({ defaultDuration: 60 });
    expect(dto.defaultPaymentMethod).toBeUndefined();
  });

  it.each([
    ['표준 밖 문자열', 'bitcoin'],
    ['빈 문자열', ''],
    ['대문자', 'CARD'],
    ['숫자', 1],
    ['null', null],
  ])('%s 는 거부된다', async (_label, value) => {
    await expect(validate({ defaultPaymentMethod: value })).rejects.toBeInstanceOf(BadRequestException);
  });
});
