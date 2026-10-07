'use client';
import * as React from 'react';
import { Spinner } from '@heroui/react';

import { startGoogleLogin } from '@/actions/auth';

/** Google 표준 컬러 "G" 로고. 색·비율 변경 금지 (브랜딩 가이드라인) */
function GoogleMark() {
  return (
    <svg
      viewBox="0 0 18 18"
      className="size-5 shrink-0"
      aria-hidden="true"
    >
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

type Props = {
  /** 기본은 로그인 시작(startGoogleLogin). 가입 폼은 동의값을 싣는 startGoogleSignup 을 넘긴다 */
  onStart?: () => Promise<void>;
  /** 가입 폼: 두 동의가 모두 체크되기 전까지 비활성 */
  isDisabled?: boolean;
};

/**
 * "Google로 계속하기" — 서버 액션이 브라우저를 api /auth/google/start 로 보내고, api 가 Google 인증 페이지로 리다이렉트한다.
 * 로그인 폼에서는 기존 계정만 통과하고(미가입자는 가입 안내), 가입 폼에서는 동의값과 함께 신규 가입을 요청한다.
 *
 * Google 브랜딩 가이드라인(Light 테마)을 따른다:
 * https://developers.google.com/identity/branding-guidelines
 * - 배경 #FFFFFF, 테두리 #747775 1px, 글자 #1F1F1F, 14px Medium
 * - 로고 20px, 좌측 12px, 로고–텍스트 10px, 우측 12px
 * HeroUI Button은 배경·글자색·아이콘 크기를 강제하므로 쓰지 않는다.
 */
export default function GoogleLoginButton({ onStart = startGoogleLogin, isDisabled = false }: Props) {
  const [isPending, startTransition] = React.useTransition();
  return (
    <button
      type="button"
      disabled={isPending || isDisabled}
      aria-busy={isPending}
      onClick={() => startTransition(async () => {
        await onStart();
      })}
      className="flex h-10 w-full items-center rounded-full border border-[#747775] bg-white pr-3 pl-3 text-sm font-medium text-[#1F1F1F] transition-colors hover:bg-[#F8F9FA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4285F4] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <GoogleMark />
      <span className="ml-2.5 grow text-center">Google로 계속하기</span>
      {isPending ? <Spinner color="current" size="sm" /> : null}
    </button>
  );
}
