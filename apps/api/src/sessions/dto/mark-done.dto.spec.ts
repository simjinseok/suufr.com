import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { MarkDoneDto } from './mark-done.dto';
import { UpdateSessionDto } from './update-session.dto';

// main.ts 의 전역 ValidationPipe 와 동일한 옵션으로 검증한다
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});

async function validate(metatype: new () => object, body: unknown) {
  return pipe.transform(body, { type: 'body', metatype });
}

describe('MarkDoneDto', () => {
  it('본문이 없어도 통과한다 (본문 없이 보내던 기존 클라이언트)', async () => {
    const dto = await validate(MarkDoneDto, undefined);
    expect(dto).toBeInstanceOf(MarkDoneDto);
    expect(dto).toStrictEqual(new MarkDoneDto());
  });

  it('빈 객체는 통과한다', async () => {
    const dto = await validate(MarkDoneDto, {});
    expect(dto).toStrictEqual(new MarkDoneDto());
  });

  it('isDone true와 isAbsent true는 boolean으로 통과한다', async () => {
    const dto = (await validate(MarkDoneDto, { isDone: true, isAbsent: true })) as MarkDoneDto;
    expect(dto.isDone).toBe(true);
    expect(dto.isAbsent).toBe(true);
  });

  it('문자열 "false"는 거부된다', async () => {
    await expect(validate(MarkDoneDto, { isAbsent: 'false' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('정의되지 않은 필드는 거부된다', async () => {
    await expect(validate(MarkDoneDto, { isDone: true, extra: 1 })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('UpdateSessionDto.isAbsent', () => {
  it('boolean true는 통과한다', async () => {
    const dto = (await validate(UpdateSessionDto, { isAbsent: true })) as UpdateSessionDto;
    expect(dto.isAbsent).toBe(true);
  });

  it('문자열 "true"는 거부된다', async () => {
    await expect(validate(UpdateSessionDto, { isAbsent: 'true' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
