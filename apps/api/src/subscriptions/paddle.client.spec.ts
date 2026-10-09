import type { ConfigService } from '@nestjs/config';
import { PaddleClient } from './paddle.client';
import { verifyCheckoutCustomData } from './checkout-custom-data';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

// Paddle API 호출만 대역으로 바꾼다 — 거래 생성 요청에 무엇이 실리는지 본다(나머지 SDK 는 실제 것)
vi.mock('@paddle/paddle-node-sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@paddle/paddle-node-sdk')>()),
  Paddle: vi.fn(function Paddle() {
    return { transactions: { create } };
  }),
}));

const USER_A = '11111111-1111-4111-8111-111111111111';
const SECRET = 'whsec_test';

function build(env: Record<string, string | undefined>) {
  const config = { get: vi.fn((key: string) => ({ PADDLE_API_KEY: 'pdl_test', ...env })[key]) } as unknown as ConfigService;
  return new PaddleClient(config);
}

beforeEach(() => {
  create.mockReset().mockResolvedValue({ id: 'txn_1' });
});

describe('PaddleClient.createCheckoutTransaction', () => {
  it('거래 custom data 에 웹훅이 검증할 수 있는 서명된 userId 를 넣는다', async () => {
    const client = build({ PADDLE_PRICE_ID_PRO: 'pri_pro', PADDLE_WEBHOOK_SECRET: SECRET });
    await expect(client.createCheckoutTransaction(USER_A)).resolves.toEqual({ transactionId: 'txn_1' });
    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0][0];
    expect(params.items).toEqual([{ priceId: 'pri_pro', quantity: 1 }]);
    expect(verifyCheckoutCustomData(params.customData, SECRET)).toBe(USER_A);
  });

  it('서명 비밀키가 없으면 서명 없는 거래를 만들지 않고 던진다', async () => {
    const client = build({ PADDLE_PRICE_ID_PRO: 'pri_pro' });
    await expect(client.createCheckoutTransaction(USER_A)).rejects.toThrow('PADDLE_WEBHOOK_SECRET is not configured');
    expect(create).not.toHaveBeenCalled();
  });
});
