/** grecaptcha.enterprise 의 우리가 쓰는 부분 */
export type GrecaptchaEnterprise = {
  ready: (cb: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

type Options = {
  siteKey: string;
  action: string;
  /** 현재 시점의 grecaptcha.enterprise. 스크립트가 아직 안 떴으면 undefined */
  getGrecaptcha: () => GrecaptchaEnterprise | undefined;
  /** 스크립트 로드가 실패로 확정됐는지(onError). true 면 기다리지 않는다 */
  scriptFailed: () => boolean;
  /** 전체 시간 예산: 스크립트 대기 + execute 합산 */
  timeoutMs: number;
  /** 스크립트 도착 폴링 간격 */
  pollMs: number;
};

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * 제출 직전에 reCAPTCHA 토큰을 받는다. 어떤 경우에도 던지지 않고, 못 받으면 undefined.
 *
 * - 스크립트가 아직 로딩 중(느린 네트워크)이면 시간 예산 안에서 도착을 기다린다 — 그래야 자동완성으로 빠르게 제출한
 *   정상 사용자가 토큰 없이 제출돼 enforce 에서 403 을 받는 일이 없다.
 * - 스크립트 로드가 실패로 확정(onError, 광고 차단기)됐으면 바로 undefined — 처리는 api RECAPTCHA_MODE 가 정한다.
 * - execute 가 응답하지 않으면 남은 예산이 지난 뒤 undefined.
 */
export async function acquireRecaptchaToken(options: Options): Promise<string | undefined> {
  const { siteKey, action, getGrecaptcha, scriptFailed, timeoutMs, pollMs } = options;
  const deadline = Date.now() + timeoutMs;

  let grecaptcha = getGrecaptcha();
  while (!grecaptcha) {
    if (scriptFailed() || Date.now() >= deadline) return undefined;
    await sleep(Math.min(pollMs, Math.max(deadline - Date.now(), 0)));
    grecaptcha = getGrecaptcha();
  }

  const remaining = Math.max(deadline - Date.now(), 0);
  const ready = grecaptcha;
  try {
    const token = await Promise.race([
      new Promise<string>((resolve, reject) => {
        ready.ready(() => {
          ready.execute(siteKey, { action }).then(resolve, reject);
        });
      }),
      sleep(remaining).then(() => undefined),
    ]);
    return token || undefined;
  }
  catch {
    return undefined;
  }
}
