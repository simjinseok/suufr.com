import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { UpdateSessionStatusDto } from './update-session-status.dto';
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

describe('UpdateSessionStatusDto', () => {
  it('absent는 통과한다', async () => {
    const dto = (await validate(UpdateSessionStatusDto, { status: 'absent' })) as UpdateSessionStatusDto;
    expect(dto).toBeInstanceOf(UpdateSessionStatusDto);
    expect(dto.status).toBe('absent');
  });

  it('status가 없으면 거부된다', async () => {
    await expect(validate(UpdateSessionStatusDto, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('정해진 값 밖의 상태는 거부된다', async () => {
    await expect(validate(UpdateSessionStatusDto, { status: 'cancelled' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('정의되지 않은 필드는 거부된다', async () => {
    await expect(validate(UpdateSessionStatusDto, { status: 'done', extra: 1 })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('UpdateSessionDto.status', () => {
  it('done은 통과한다', async () => {
    const dto = (await validate(UpdateSessionDto, { status: 'done' })) as UpdateSessionDto;
    expect(dto.status).toBe('done');
  });

  it('isDone은 받지 않는다', async () => {
    await expect(validate(UpdateSessionDto, { isDone: true })).rejects.toBeInstanceOf(BadRequestException);
  });
});
