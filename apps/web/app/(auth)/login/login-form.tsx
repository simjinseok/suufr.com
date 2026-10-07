'use client';
import * as React from 'react';
import {
  Form,
  Input,
  InputOTP,
  Button,
  TextField,
  Label,
  FieldError,
} from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { login, respondToMfa } from '@/actions/auth';
import GoogleLoginButton from '@/components/auth/google-login-button';

const SOCIAL_ERROR_MESSAGE = 'Google 로그인에 실패했습니다. 다시 시도해주세요.';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Google 로그인 콜백이 2FA 챌린지를 mfa_session 쿠키에 담고 ?step=mfa 로 보낸다
  const [showMfa, setShowMfa] = React.useState(searchParams.get('step') === 'mfa');
  // 기본은 인증 앱 6자리(InputOTP), 백업코드(xxxxx-xxxxx)는 일반 입력으로 전환
  const [useBackupCode, setUseBackupCode] = React.useState(false);
  // InputOTP 는 TextField 와 달리 Form 의 validationErrors 를 모르므로, 제출 에러를 직접 넘기고
  // 다시 입력을 시작하면(해당 제출의 timestamp 를 기억해) 에러 표시를 지운다
  const [otpErrorDismissedAt, setOtpErrorDismissedAt] = React.useState<number | undefined>();
  const socialError = searchParams.get('error') === 'social' ? SOCIAL_ERROR_MESSAGE : null;

  const [loginState, loginAction, isLoginPending] = React.useActionState(
    login,
    {
      fields: { email: '', password: '' },
    },
  );

  const [mfaState, mfaAction, isMfaPending] = React.useActionState(
    respondToMfa,
    {
      fields: { code: '' },
    },
  );

  const loginForm = useForm({
    values: {
      email: loginState.fields?.email || '',
      password: '',
    },
  });

  const mfaForm = useForm({
    values: {
      code: '',
    },
  });

  React.useEffect(() => {
    if (!loginState.timestamp) return;

    if (loginState.success) {
      router.push('/dashboard');
    }
    else if (loginState.requiresMfa) {
      setShowMfa(true);
    }
  }, [loginState.timestamp, loginState.success, loginState.requiresMfa, router]);

  React.useEffect(() => {
    if (!mfaState.timestamp) return;

    if (mfaState.success) {
      router.push('/dashboard');
    }
  }, [mfaState.timestamp, mfaState.success, router]);

  // 각 화면 루트의 key는 필수 — 두 화면의 JSX 구조가 같아 key가 없으면 React가 폼을
  // 리마운트하지 않고 재활용하는데, 그러면 RHF Controller가 다른 폼의 control에 묶여 입력이 안 된다.
  if (showMfa) {
    const otpError = otpErrorDismissedAt === mfaState.timestamp ? undefined : mfaState.fieldErrors?.code?.[0];

    return (
      <div key="mfa" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50">
        <div className="w-full max-w-sm mx-auto px-6">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-2xl font-bold text-white">스</span>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">
              2단계 인증
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              {useBackupCode ? '백업코드를 입력하세요' : '인증 앱의 6자리 코드를 입력하세요'}
            </p>
          </div>

          <Form
            className="flex flex-col gap-4"
            action={mfaAction}
            validationErrors={mfaState.fieldErrors}
          >
            {mfaState.message && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                {mfaState.message}
              </div>
            )}

            {useBackupCode
              ? (
                  <Controller
                    control={mfaForm.control}
                    name="code"
                    render={({ field: { name, value, onChange } }) => (
                      <TextField
                        name={name}
                        value={value}
                        onChange={onChange}
                        isRequired
                      >
                        <Label>백업코드</Label>
                        <Input
                          variant="secondary"
                          type="text"
                          inputMode="text"
                          maxLength={32}
                          placeholder="xxxxx-xxxxx"
                          autoComplete="off"
                          autoFocus
                        />
                        <FieldError />
                      </TextField>
                    )}
                  />
                )
              : (
                  <Controller
                    control={mfaForm.control}
                    name="code"
                    render={({ field: { name, value, onChange } }) => (
                      <div className="flex flex-col items-center gap-2">
                        <InputOTP
                          name={name}
                          value={value}
                          onChange={(next) => {
                            onChange(next);
                            setOtpErrorDismissedAt(mfaState.timestamp);
                          }}
                          maxLength={6}
                          pattern={'^\\d*$'}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          autoFocus
                          variant="secondary"
                          // 루트가 w-full 이면 안쪽 그룹이 왼쪽에 붙는다 — 내용 폭으로 줄여 바깥 items-center 로 가운데 정렬
                          className="w-auto"
                          aria-label="인증 코드"
                          isInvalid={!!otpError}
                          validationErrors={otpError ? [otpError] : undefined}
                        >
                          <InputOTP.Group>
                            {Array.from({ length: 6 }, (_, i) => (
                              <InputOTP.Slot key={i} index={i} />
                            ))}
                          </InputOTP.Group>
                        </InputOTP>
                        {otpError && (
                          <p className="text-sm text-danger">{otpError}</p>
                        )}
                      </div>
                    )}
                  />
                )}

            <Button
              type="submit"
              variant="primary"
              isPending={isMfaPending}
              className="w-full"
            >
              인증
            </Button>

            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  mfaForm.setValue('code', '');
                  setUseBackupCode(v => !v);
                }}
                className="text-sm text-violet-600 hover:text-violet-700 font-medium"
              >
                {useBackupCode ? '인증 앱 코드로 인증' : '백업코드로 인증'}
              </button>
              <button
                type="button"
                onClick={() => setShowMfa(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                다시 로그인
              </button>
            </div>
          </Form>
        </div>
      </div>
    );
  }

  return (
    <div key="login" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <span className="text-2xl font-bold text-white">스</span>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">스프</h1>
          <p className="mt-2 text-sm text-gray-500">과외 일정 관리 서비스</p>
        </div>

        <Form
          className="flex flex-col gap-4"
          action={loginAction}
          validationErrors={loginState.fieldErrors}
        >
          {(loginState.message || socialError) && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {loginState.message || socialError}
            </div>
          )}

          <Controller
            control={loginForm.control}
            name="email"
            render={({ field: { name, value, onChange } }) => (
              <TextField
                name={name}
                value={value}
                onChange={onChange}
                isRequired
              >
                <Label>이메일</Label>
                <Input variant="secondary" type="email" placeholder="email@example.com" />
                <FieldError />
              </TextField>
            )}
          />

          <Controller
            control={loginForm.control}
            name="password"
            render={({ field: { name, value, onChange } }) => (
              <TextField
                name={name}
                value={value}
                onChange={onChange}
                isRequired
              >
                <Label>비밀번호</Label>
                <Input variant="secondary" type="password" placeholder="비밀번호" />
                <FieldError />
              </TextField>
            )}
          />

          <Button
            type="submit"
            variant="primary"
            isPending={isLoginPending}
            className="w-full mt-2"
          >
            로그인
          </Button>
        </Form>

        <div className="my-5 flex items-center gap-3 text-xs text-gray-400">
          <div className="h-px grow bg-gray-200" />
          또는
          <div className="h-px grow bg-gray-200" />
        </div>

        <GoogleLoginButton />

        <div className="mt-6 flex flex-col gap-2 text-center text-sm">
          <Link
            href="/forgot-password"
            className="text-gray-500 hover:text-gray-700"
          >
            비밀번호를 잊으셨나요?
          </Link>
          <div className="text-gray-500">
            계정이 없으신가요?
            {' '}
            <Link href="/signup" className="text-violet-600 hover:text-violet-700 font-medium">
              회원가입
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
