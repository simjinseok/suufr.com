import * as React from 'react';
import LoginForm from './login-form';

// LoginForm 이 useSearchParams 를 쓰므로(소셜 로그인 콜백의 step/error) Suspense 경계가 필요하다
export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  );
}
