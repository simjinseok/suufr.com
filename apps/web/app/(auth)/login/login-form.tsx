'use client';
import * as React from 'react';
import {
  Form,
  Input,
  Button,
  TextField,
  Label,
  FieldError,
} from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { login, respondToMfa, respondToNewPassword } from '@/actions/auth';

export default function LoginForm() {
  const router = useRouter();
  const [showMfa, setShowMfa] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);

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

  const [newPasswordState, newPasswordAction, isNewPasswordPending] = React.useActionState(
    respondToNewPassword,
    {
      fields: { password: '', passwordConfirm: '' },
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

  const newPasswordForm = useForm({
    values: {
      password: '',
      passwordConfirm: '',
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
    else if (loginState.requiresNewPassword) {
      setShowNewPassword(true);
    }
  }, [loginState.timestamp, loginState.success, loginState.requiresMfa, loginState.requiresNewPassword, router]);

  React.useEffect(() => {
    if (!mfaState.timestamp) return;

    if (mfaState.success) {
      router.push('/dashboard');
    }
  }, [mfaState.timestamp, mfaState.success, router]);

  React.useEffect(() => {
    if (!newPasswordState.timestamp) return;

    if (newPasswordState.success) {
      router.push('/dashboard');
    }
  }, [newPasswordState.timestamp, newPasswordState.success, router]);

  if (showNewPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50">
        <div className="w-full max-w-sm mx-auto px-6">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-2xl font-bold text-white">스</span>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">
              새 비밀번호 설정
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              계속하려면 새 비밀번호를 설정해야 합니다
            </p>
          </div>

          <Form
            className="flex flex-col gap-4"
            action={newPasswordAction}
            validationErrors={newPasswordState.fieldErrors}
          >
            {newPasswordState.message && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                {newPasswordState.message}
              </div>
            )}

            <Controller
              control={newPasswordForm.control}
              name="password"
              render={({ field: { name, value, onChange } }) => (
                <TextField
                  name={name}
                  value={value}
                  onChange={onChange}
                  isRequired
                >
                  <Label>새 비밀번호</Label>
                  <Input
                    variant="secondary"
                    type="password"
                    placeholder="8자 이상"
                    autoComplete="new-password"
                  />
                  <FieldError />
                </TextField>
              )}
            />

            <Controller
              control={newPasswordForm.control}
              name="passwordConfirm"
              render={({ field: { name, value, onChange } }) => (
                <TextField
                  name={name}
                  value={value}
                  onChange={onChange}
                  isRequired
                >
                  <Label>새 비밀번호 확인</Label>
                  <Input
                    variant="secondary"
                    type="password"
                    placeholder="비밀번호 재입력"
                    autoComplete="new-password"
                  />
                  <FieldError />
                </TextField>
              )}
            />

            <Button
              type="submit"
              variant="primary"
              isPending={isNewPasswordPending}
              className="w-full"
            >
              비밀번호 설정
            </Button>

            <button
              type="button"
              onClick={() => setShowNewPassword(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              다시 로그인
            </button>
          </Form>
        </div>
      </div>
    );
  }

  if (showMfa) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50">
        <div className="w-full max-w-sm mx-auto px-6">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-2xl font-bold text-white">스</span>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">
              2단계 인증
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              인증 앱의 6자리 코드를 입력하세요
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
                  <Label>MFA 코드</Label>
                  <Input
                    variant="secondary"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    autoComplete="one-time-code"
                  />
                  <FieldError />
                </TextField>
              )}
            />

            <Button
              type="submit"
              variant="primary"
              isPending={isMfaPending}
              className="w-full"
            >
              인증
            </Button>

            <button
              type="button"
              onClick={() => setShowMfa(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              다시 로그인
            </button>
          </Form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50">
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
          {loginState.message && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {loginState.message}
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
