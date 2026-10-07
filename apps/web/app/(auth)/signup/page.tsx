import * as React from 'react';
import SignupForm from './signup-form';

export default function SignupPage() {
  // 런타임 env 를 요청마다 읽는다 (빌드 타임 인라인 아님 — Coolify 에서 키를 바꿔도 재빌드 불필요).
  // (auth) 레이아웃이 cookies() 를 쓰므로 이 페이지는 이미 동적 렌더링이다 — force-dynamic 불필요.
  // 스크립트 로더는 폼 안에서 렌더한다(로드 실패를 훅에 알려야 하므로).
  // SignupForm 이 useSearchParams 를 쓰므로(Google 가입 시작의 ?error) Suspense 경계가 필요하다
  return (
    <React.Suspense fallback={null}>
      <SignupForm recaptchaSiteKey={process.env.RECAPTCHA_SITE_KEY || null} />
    </React.Suspense>
  );
}
