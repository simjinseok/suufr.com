import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { IsBoolean, IsOptional } from 'class-validator';
import { StrictBoolean } from './strict-boolean.decorator';

// main.ts 의 전역 ValidationPipe 와 동일한 옵션으로 검증한다
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});

class StrictDto {
  @IsBoolean()
  @StrictBoolean()
  @IsOptional()
  flag?: boolean;
}

class LooseDto {
  @IsBoolean()
  @IsOptional()
  flag?: boolean;
}

function validate(metatype: new () => object, body: unknown) {
  return pipe.transform(body, { type: 'body', metatype });
}

describe('StrictBoolean', () => {
  it('없으면 implicit conversion 이 "false" 를 true 로 바꾼다 (데코레이터가 필요한 이유)', async () => {
    await expect(validate(LooseDto, { flag: 'false' })).resolves.toEqual({ flag: true });
  });

  it.each([true, false])('불리언 %s 는 그대로 통과한다', async (value) => {
    await expect(validate(StrictDto, { flag: value })).resolves.toEqual({ flag: value });
  });

  it.each(['true', 'false', 'yes', '', 1, 0])('불리언이 아닌 값 %j 는 거부된다', async (value) => {
    await expect(validate(StrictDto, { flag: value })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('값이 없으면 @IsOptional 대로 통과한다', async () => {
    const dto = await validate(StrictDto, {});
    expect(dto).toBeInstanceOf(StrictDto);
    expect((dto as StrictDto).flag).toBeUndefined();
  });
});
