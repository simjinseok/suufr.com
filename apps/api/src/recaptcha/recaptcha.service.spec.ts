import { ForbiddenException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAPTCHA_FAILED, RecaptchaService } from './recaptcha.service';

vi.mock('@sentry/nestjs', () => ({ captureException: vi.fn() }));

type Env = Partial<Record<'RECAPTCHA_MODE' | 'RECAPTCHA_PROJECT_ID' | 'RECAPTCHA_SITE_KEY' | 'RECAPTCHA_API_KEY' | 'RECAPTCHA_MIN_SCORE', string>>;

const FULL: Env = { RECAPTCHA_PROJECT_ID: 'proj', RECAPTCHA_SITE_KEY: 'site', RECAPTCHA_API_KEY: 'apikey' };

function build(env: Env) {
  const config = { get: vi.fn((key: keyof Env) => env[key]) };
  return new RecaptchaService(config as never);
}

/** Google 평가 API 응답을 흉내내는 fetch. 호출 인자를 검사할 수 있게 mock 을 돌려준다. */
function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const okAssessment = (score: number, action = 'signup') => ({
  tokenProperties: { valid: true, action, hostname: 'suufr.com' },
  riskAnalysis: { score, reasons: [] },
});

afterEach(() => vi.unstubAllGlobals());

describe('RecaptchaService', () => {
  describe('off 모드', () => {
    it('기본값(off)에서는 토큰 유무와 무관하게 Google 을 호출하지 않고 통과한다', async () => {
      const fetchMock = stubFetch({});
      const service = build({});
      await expect(service.verifySignup(undefined, {})).resolves.toBeUndefined();
      await expect(service.verifySignup('tok', {})).resolves.toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('mode 가 off 가 아닌데 키가 하나라도 비면 off 로 동작한다 (기동 실패 금지)', async () => {
      const fetchMock = stubFetch({});
      const service = build({ RECAPTCHA_MODE: 'enforce', RECAPTCHA_PROJECT_ID: 'proj', RECAPTCHA_SITE_KEY: 'site' });
      await expect(service.verifySignup(undefined, {})).resolves.toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('monitor 모드', () => {
    it('토큰이 없어도 통과한다', async () => {
      const fetchMock = stubFetch({});
      const service = build({ ...FULL, RECAPTCHA_MODE: 'monitor' });
      await expect(service.verifySignup(undefined, {})).resolves.toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('점수가 낮아도 평가만 하고 통과한다', async () => {
      stubFetch(okAssessment(0.1));
      const service = build({ ...FULL, RECAPTCHA_MODE: 'monitor' });
      await expect(service.verifySignup('tok', { ip: '1.1.1.1', userAgent: 'ua' })).resolves.toBeUndefined();
    });
  });

  describe('enforce 모드', () => {
    const env: Env = { ...FULL, RECAPTCHA_MODE: 'enforce' };

    it('토큰이 없으면 403 CAPTCHA_FAILED', async () => {
      stubFetch({});
      const service = build(env);
      const error = await service.verifySignup(undefined, {}).catch(e => e);
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({ error: CAPTCHA_FAILED });
    });

    it('평가 요청에 토큰·사이트키·action·IP·UA 를 싣고 API 키는 쿼리로 보낸다', async () => {
      const fetchMock = stubFetch(okAssessment(0.9));
      const service = build(env);
      await service.verifySignup('tok', { ip: '203.0.113.5', userAgent: 'Mozilla' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://recaptchaenterprise.googleapis.com/v1/projects/proj/assessments?key=apikey');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        event: { token: 'tok', siteKey: 'site', expectedAction: 'signup', userIpAddress: '203.0.113.5', userAgent: 'Mozilla' },
      });
    });

    it('유효 토큰 + 임계값 이상 점수면 통과한다 (기본 임계값 0.5, 경계 포함)', async () => {
      stubFetch(okAssessment(0.5));
      await expect(build(env).verifySignup('tok', {})).resolves.toBeUndefined();
    });

    it('점수가 임계값 미만이면 403', async () => {
      stubFetch(okAssessment(0.3));
      await expect(build(env).verifySignup('tok', {})).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('RECAPTCHA_MIN_SCORE 로 임계값을 바꿀 수 있다', async () => {
      stubFetch(okAssessment(0.6));
      await expect(build({ ...env, RECAPTCHA_MIN_SCORE: '0.7' }).verifySignup('tok', {})).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('RECAPTCHA_MIN_SCORE 가 빈 문자열이거나 범위 밖이면 기본 0.5 를 쓴다 (Number("") === 0 함정)', async () => {
      stubFetch(okAssessment(0.3));
      await expect(build({ ...env, RECAPTCHA_MIN_SCORE: '' }).verifySignup('tok', {})).rejects.toBeInstanceOf(ForbiddenException);
      stubFetch(okAssessment(0.3));
      await expect(build({ ...env, RECAPTCHA_MIN_SCORE: '1.5' }).verifySignup('tok', {})).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('RECAPTCHA_MODE 가 빈 문자열이면 off 로 동작한다', async () => {
      const fetchMock = stubFetch({});
      await expect(build({ ...FULL, RECAPTCHA_MODE: '' }).verifySignup(undefined, {})).resolves.toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('action 이 signup 이 아닌 유효 토큰은 거부한다 (다른 페이지 토큰 재사용)', async () => {
      stubFetch(okAssessment(0.9, 'login'));
      await expect(build(env).verifySignup('tok', {})).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('valid=false 응답은 riskAnalysis 가 없어도 터지지 않고 거부한다', async () => {
      stubFetch({ tokenProperties: { valid: false, invalidReason: 'EXPIRED' } });
      await expect(build(env).verifySignup('tok', {})).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Google 호출이 5xx 면 fail-open 으로 통과한다', async () => {
      stubFetch({ error: { message: 'backend' } }, 503);
      await expect(build(env).verifySignup('tok', {})).resolves.toBeUndefined();
    });

    it('Google 호출이 네트워크 오류로 reject 되면 fail-open 으로 통과한다', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
      await expect(build(env).verifySignup('tok', {})).resolves.toBeUndefined();
    });
  });
});
