'use client';
import * as React from 'react';
import Script from 'next/script';
import { acquireRecaptchaToken, type GrecaptchaEnterprise } from './recaptcha-token';

/** api RecaptchaService 의 expectedAction 과 같아야 한다 */
export const RECAPTCHA_ACTION_SIGNUP = 'signup';

/** 스크립트 대기 + 토큰 발급 전체 시간 예산 */
const TOKEN_TIMEOUT_MS = 8000;
const SCRIPT_POLL_MS = 100;

declare global {
  interface Window { grecaptcha?: { enterprise?: GrecaptchaEnterprise } }
}

/**
 * 점수 기반 키 로더. 토큰을 쓰는 폼 안에서 렌더해 로드 실패를 훅에 알린다 (useRecaptcha 의 onScriptError).
 * 사이트 키가 없으면 렌더하지 않는다.
 */
export function RecaptchaScript({ siteKey, onError }: { siteKey: string; onError?: () => void }) {
  return (
    <Script
      src={`https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(siteKey)}`}
      strategy="afterInteractive"
      onError={onError}
    />
  );
}

/**
 * 제출 직전에 토큰을 받는다 (토큰은 2분 안에 평가돼야 하므로 미리 받아두지 않는다).
 * 스크립트가 로딩 중이면 시간 예산 안에서 기다리고, 로드 실패가 확정됐거나 시간이 지나면 undefined —
 * 폼은 토큰 없이 제출하고 처리는 api RECAPTCHA_MODE 가 정한다. 여기서 가입을 막으면 enforce 가 아닌 환경에서도 정상 사용자가 막힌다.
 */
export function useRecaptcha(siteKey: string | null) {
  const scriptFailed = React.useRef(false);
  const onScriptError = React.useCallback(() => {
    scriptFailed.current = true;
  }, []);

  const getToken = React.useCallback(async (action: string): Promise<string | undefined> => {
    if (!siteKey) return undefined;
    return acquireRecaptchaToken({
      siteKey,
      action,
      getGrecaptcha: () => window.grecaptcha?.enterprise,
      scriptFailed: () => scriptFailed.current,
      timeoutMs: TOKEN_TIMEOUT_MS,
      pollMs: SCRIPT_POLL_MS,
    });
  }, [siteKey]);

  return { getToken, onScriptError };
}

/** 배지를 숨기는 대신 Google 이 요구하는 고지 (globals.css 의 .grecaptcha-badge 와 짝) */
export function RecaptchaNotice() {
  return (
    <p className="text-center text-xs text-gray-400">
      이 사이트는 reCAPTCHA 로 보호되며 Google
      {' '}
      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline">개인정보처리방침</a>
      과
      {' '}
      <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline">서비스 약관</a>
      이 적용됩니다.
    </p>
  );
}
