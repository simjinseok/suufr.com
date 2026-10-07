import { AsyncLocalStorage } from 'node:async_hooks';

type Store = { error?: unknown };

const storage = new AsyncLocalStorage<Store>();

/**
 * better-auth 는 OTP 발송 콜백(sendVerificationOTP)이 던진 에러를 runInBackgroundOrAwait 에서 잡아 로그만 남기고
 * 가입·재발송·비밀번호찾기를 성공으로 응답한다. 그러면 사용자는 오지 않는 메일을 기다리게 되므로,
 * 콜백은 실패를 요청 단위 저장소에 기록하고(recordOtpMailFailure) 호출자는 better-auth 호출이 끝난 뒤
 * 기록을 확인해 다시 던진다(rethrowOtpMailFailure). better-auth 가 콜백을 await 하므로 비동기 컨텍스트가 이어진다.
 */
export function recordOtpMailFailure(error: unknown): void {
  const store = storage.getStore();
  if (store && store.error === undefined) store.error = error;
}

export async function rethrowOtpMailFailure<T>(fn: () => Promise<T>): Promise<T> {
  const store: Store = {};
  const result = await storage.run(store, fn);
  if (store.error !== undefined) throw store.error;
  return result;
}
