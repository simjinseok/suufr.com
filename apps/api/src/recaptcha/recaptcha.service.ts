import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';

export type RecaptchaMode = 'off' | 'monitor' | 'enforce';

export const CAPTCHA_FAILED = 'CAPTCHA_FAILED';
const CAPTCHA_FAILED_MESSAGE = '자동 가입 방지 확인에 실패했습니다. 페이지를 새로 고친 뒤 다시 시도해주세요';

const ASSESSMENT_URL = 'https://recaptchaenterprise.googleapis.com/v1/projects';
const SIGNUP_ACTION = 'signup';
const DEFAULT_MIN_SCORE = 0.5;
const ASSESSMENT_TIMEOUT_MS = 5000;

/** Google 평가 API 응답 중 판정에 쓰는 부분. 토큰이 무효하면 riskAnalysis 가 빠질 수 있다 */
type Assessment = {
  tokenProperties?: { valid?: boolean; invalidReason?: string; action?: string; hostname?: string };
  riskAnalysis?: { score?: number; reasons?: string[] };
};

type Verdict = { pass: boolean; reason: string; score?: number; reasons?: string[] };

type RequestMeta = { ip?: string; userAgent?: string };

/**
 * reCAPTCHA Enterprise 평가. 가입(/auth/signup)에서 better-auth 호출 전에 쓴다.
 *
 * RECAPTCHA_MODE
 *  - off(기본): 아무것도 하지 않는다. 로컬·테스트.
 *  - monitor: 토큰이 있으면 평가하고 결과를 로그로만 남긴다. 토큰이 없어도 통과(iOS 가 SDK 를 붙이기 전까지 쓰는 모드).
 *  - enforce: 토큰이 없거나 무효하거나 점수가 RECAPTCHA_MIN_SCORE 미만이면 403 CAPTCHA_FAILED.
 *
 * Google 호출 자체가 실패하면 모드와 무관하게 통과(fail-open)시키고 Sentry 에 남긴다 — Google 장애로 가입이 멈추는 쪽이 더 큰 손해다.
 * 로그에 이메일은 남기지 않는다.
 */
@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);
  readonly mode: RecaptchaMode;
  private readonly projectId?: string;
  private readonly siteKey?: string;
  private readonly apiKey?: string;
  private readonly minScore: number;

  constructor(private readonly config: ConfigService) {
    // 빈 문자열(Coolify 에 키만 만들고 값을 비운 경우)은 미설정과 같게 본다 — ?? 가 아니라 || 를 쓴다
    const requested = (this.config.get<string>('RECAPTCHA_MODE') || 'off') as RecaptchaMode;
    this.projectId = this.config.get<string>('RECAPTCHA_PROJECT_ID') || undefined;
    this.siteKey = this.config.get<string>('RECAPTCHA_SITE_KEY') || undefined;
    this.apiKey = this.config.get<string>('RECAPTCHA_API_KEY') || undefined;

    // Number('') 는 0 이라 빈 값이 "모두 통과" 임계값이 되므로 먼저 걸러낸다
    const rawScore = this.config.get<string>('RECAPTCHA_MIN_SCORE');
    const parsedScore = rawScore ? Number(rawScore) : Number.NaN;
    this.minScore = Number.isFinite(parsedScore) && parsedScore >= 0 && parsedScore <= 1 ? parsedScore : DEFAULT_MIN_SCORE;

    if (requested !== 'off' && requested !== 'monitor' && requested !== 'enforce') {
      this.logger.error(`RECAPTCHA_MODE=${requested} 는 알 수 없는 값입니다 — off 로 동작합니다`);
      this.mode = 'off';
    }
    else if (requested !== 'off' && !(this.projectId && this.siteKey && this.apiKey)) {
      // 기동 실패보다 보호 없이 뜨는 편이 안전. 로그·Sentry 로 발견한다
      this.logger.error('RECAPTCHA_PROJECT_ID / RECAPTCHA_SITE_KEY / RECAPTCHA_API_KEY 가 모두 필요합니다 — reCAPTCHA 를 off 로 동작합니다');
      this.mode = 'off';
    }
    else {
      this.mode = requested;
    }
  }

  /** 거부 시 ForbiddenException(CAPTCHA_FAILED). 통과 시 resolve. */
  async verifySignup(token: string | undefined, meta: RequestMeta): Promise<void> {
    if (this.mode === 'off') return;

    if (!token) {
      this.logger.warn(`reCAPTCHA 토큰 없음 mode=${this.mode} ip=${meta.ip ?? '-'}`);
      if (this.mode === 'enforce') throw this.rejection();
      return;
    }

    const assessment = await this.assess(token, meta);
    if (!assessment) return; // 호출 실패 → fail-open (assess 가 이미 기록)

    const verdict = this.judge(assessment);
    this.logger.log(
      `reCAPTCHA mode=${this.mode} pass=${verdict.pass} reason=${verdict.reason} score=${verdict.score ?? '-'} `
      + `reasons=${(verdict.reasons ?? []).join(',') || '-'} ip=${meta.ip ?? '-'}`,
    );

    if (!verdict.pass && this.mode === 'enforce') throw this.rejection();
  }

  private judge(a: Assessment): Verdict {
    const score = a.riskAnalysis?.score;
    const reasons = a.riskAnalysis?.reasons;
    if (!a.tokenProperties?.valid) return { pass: false, reason: `invalid:${a.tokenProperties?.invalidReason ?? 'UNKNOWN'}`, score, reasons };
    if (a.tokenProperties.action !== SIGNUP_ACTION) return { pass: false, reason: `action:${a.tokenProperties.action ?? '-'}`, score, reasons };
    if (typeof score !== 'number') return { pass: false, reason: 'no-score', reasons };
    if (score < this.minScore) return { pass: false, reason: `score<${this.minScore}`, score, reasons };
    return { pass: true, reason: 'ok', score, reasons };
  }

  /** Google 평가 API 호출. 실패하면 undefined (호출자는 fail-open). */
  private async assess(token: string, meta: RequestMeta): Promise<Assessment | undefined> {
    const url = `${ASSESSMENT_URL}/${this.projectId}/assessments?key=${this.apiKey}`;
    const body = {
      event: {
        token,
        siteKey: this.siteKey,
        expectedAction: SIGNUP_ACTION,
        ...(meta.ip ? { userIpAddress: meta.ip } : {}),
        ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(ASSESSMENT_TIMEOUT_MS),
      });
      if (!response.ok) {
        // URL 에 API 키가 붙어 있으므로 상태 코드만 남긴다
        throw new Error(`assessments ${response.status}`);
      }
      return (await response.json()) as Assessment;
    }
    catch (error) {
      this.logger.error(`reCAPTCHA 평가 호출 실패 — fail-open: ${(error as Error).message}`);
      Sentry.captureException(error);
      return undefined;
    }
  }

  private rejection() {
    return new ForbiddenException({ message: CAPTCHA_FAILED_MESSAGE, error: CAPTCHA_FAILED });
  }
}
