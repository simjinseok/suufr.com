import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { AppleNativeLoginDto } from './social.dto';

// main.ts 의 전역 ValidationPipe 와 같은 옵션
const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } });
const validate = (body: unknown) => pipe.transform(body, { type: 'body', metatype: AppleNativeLoginDto });
const valid = { idToken: 'eyJ.apple.token', nonce: 'raw-nonce' };

describe('AppleNativeLoginDto', () => {
  it('identity token 과 nonce 만으로 통과하고, code·이름은 선택이다', async () => {
    await expect(validate(valid)).resolves.toBeInstanceOf(AppleNativeLoginDto);
    await expect(validate({ ...valid, authorizationCode: 'c1', name: '홍길동' })).resolves.toMatchObject({ authorizationCode: 'c1', name: '홍길동' });
  });

  it('idToken 4096자·nonce 256자·authorizationCode 1024자까지는 통과한다', async () => {
    await expect(validate({ idToken: 'a'.repeat(4096), nonce: 'n'.repeat(256), authorizationCode: 'c'.repeat(1024) })).resolves.toBeInstanceOf(AppleNativeLoginDto);
  });

  it.each([
    ['4096자 넘는 idToken', { ...valid, idToken: 'a'.repeat(4097) }],
    ['256자 넘는 nonce', { ...valid, nonce: 'n'.repeat(257) }],
    ['1024자 넘는 authorizationCode', { ...valid, authorizationCode: 'c'.repeat(1025) }],
    ['nonce 없음', { idToken: 'eyJ.apple.token' }],
    ['빈 nonce', { ...valid, nonce: '' }],
    ['idToken 없음', { nonce: 'raw-nonce' }],
    ['100자 넘는 이름', { ...valid, name: '가'.repeat(101) }],
    ['모르는 필드', { ...valid, email: 'a@b.c' }],
  ])('%s 이면 400', async (_, body) => {
    await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException);
  });
});
