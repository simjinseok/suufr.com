import { buildCheckoutCustomData, verifyCheckoutCustomData } from './checkout-custom-data';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const SECRET = 'whsec_test_secret';

describe('checkout custom data 서명', () => {
  it('서버가 만든 custom data 는 같은 비밀키로 검증되어 userId 를 돌려준다', () => {
    const data = buildCheckoutCustomData(USER_A, SECRET);
    expect(data.userId).toBe(USER_A);
    expect(typeof data.sig).toBe('string');
    expect(verifyCheckoutCustomData(data, SECRET)).toBe(USER_A);
  });

  it('서명 없이 userId 만 있으면(클라이언트가 직접 연 체크아웃) null', () => {
    expect(verifyCheckoutCustomData({ userId: USER_A }, SECRET)).toBeNull();
  });

  it('userId 를 바꿔치기하면 서명이 맞지 않아 null', () => {
    const data = buildCheckoutCustomData(USER_A, SECRET);
    expect(verifyCheckoutCustomData({ ...data, userId: USER_B }, SECRET)).toBeNull();
  });

  it('다른 비밀키로 만든 서명·길이가 다른 서명·빈 입력은 모두 null', () => {
    const data = buildCheckoutCustomData(USER_A, 'other-secret');
    expect(verifyCheckoutCustomData(data, SECRET)).toBeNull();
    expect(verifyCheckoutCustomData({ userId: USER_A, sig: 'abc' }, SECRET)).toBeNull();
    expect(verifyCheckoutCustomData({ userId: USER_A, sig: 123 }, SECRET)).toBeNull();
    expect(verifyCheckoutCustomData(null, SECRET)).toBeNull();
    expect(verifyCheckoutCustomData('string', SECRET)).toBeNull();
  });

  it('uuid 형식이 아닌 userId 는 서명이 맞아도 null', () => {
    const data = buildCheckoutCustomData('nope', SECRET);
    expect(verifyCheckoutCustomData(data, SECRET)).toBeNull();
  });

  it('비밀키가 비어 있으면 검증은 항상 null (서명 없는 신뢰로 되돌아가지 않는다)', () => {
    const data = buildCheckoutCustomData(USER_A, SECRET);
    expect(verifyCheckoutCustomData(data, '')).toBeNull();
    expect(verifyCheckoutCustomData(data, undefined)).toBeNull();
  });
});
