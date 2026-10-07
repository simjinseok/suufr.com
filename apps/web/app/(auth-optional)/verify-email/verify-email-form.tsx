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
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { verifyEmail, resendVerification } from '@/actions/auth';

/** loggedIn: 가입 직후처럼 이미 로그인된 상태 — 인증을 마치면 대시보드로 가고, "나중에 하기"로 건너뛸 수 있다 */
export default function VerifyEmailForm({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get('email') || '';
  // 가입은 됐지만 인증코드 메일 발송에 실패해 넘어온 경우
  const mailFailed = searchParams.get('mailFailed') === '1';

  const [state, formAction, isPending] = React.useActionState(verifyEmail, {
    fields: { email: emailFromQuery, code: '' },
  });

  const [resendState, resendAction, isResending] = React.useActionState(
    resendVerification,
    {
      fields: { email: emailFromQuery },
    },
  );

  const { control } = useForm({
    values: {
      email: state.fields?.email || emailFromQuery,
      code: '',
    },
  });

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      router.push(state.loggedIn ? '/dashboard' : '/login');
    }
  }, [state.timestamp, state.success, state.loggedIn, router]);

  return (
    <React.Fragment>
      <Form
        className="flex flex-col gap-4"
        action={formAction}
        validationErrors={state.fieldErrors}
      >
        {mailFailed && !resendState.timestamp && (
          <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            계정은 만들어졌지만 인증코드 메일을 보내지 못했습니다. 아래 &quot;인증코드 다시 받기&quot;를 눌러주세요.
          </div>
        )}

        {state.message && !state.success && (
          <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {state.message}
          </div>
        )}

        {resendState.message && (
          <div
            className={`p-3 rounded-lg text-sm ${
              resendState.success
                ? 'bg-green-50 text-green-600'
                : 'bg-red-50 text-red-600'
            }`}
          >
            {resendState.message}
          </div>
        )}

        <Controller
          control={control}
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
          control={control}
          name="code"
          render={({ field: { name, value, onChange } }) => (
            <TextField
              name={name}
              value={value}
              onChange={onChange}
              isRequired
            >
              <Label>인증코드</Label>
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
          isPending={isPending}
          className="w-full mt-2"
        >
          인증하기
        </Button>
      </Form>

      <div className="mt-4">
        <Form action={resendAction}>
          <input
            type="hidden"
            name="email"
            value={state.fields?.email || emailFromQuery}
          />
          <Button
            type="submit"
            variant="ghost"
            isPending={isResending}
            className="w-full"
          >
            인증코드 다시 받기
          </Button>
        </Form>
      </div>

      <div className="mt-6 text-center text-sm">
        {loggedIn
          ? (
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
                나중에 하기
              </Link>
            )
          : (
              <Link href="/login" className="text-gray-500 hover:text-gray-700">
                로그인으로 돌아가기
              </Link>
            )}
      </div>
    </React.Fragment>
  );
}
