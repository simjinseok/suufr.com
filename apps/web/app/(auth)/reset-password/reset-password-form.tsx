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

import { forgotPassword, resetPassword } from '@/actions/auth';

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get('email') || '';

  const [state, formAction, isPending] = React.useActionState(resetPassword, {
    fields: {
      email: emailFromQuery,
      code: '',
      password: '',
      passwordConfirm: '',
    },
  });

  // 코드 재발송 — 비밀번호 찾기 액션을 그대로 쓴다 (없는 이메일도 성공으로 응답하는 열거 방지 동작 포함)
  const [resendState, resendAction, isResending] = React.useActionState(forgotPassword, { fields: { email: emailFromQuery } });

  const { control } = useForm({
    values: {
      email: state.fields?.email || emailFromQuery,
      code: '',
      password: '',
      passwordConfirm: '',
    },
  });

  const currentEmail = state.fields?.email || emailFromQuery;

  React.useEffect(() => {
    if (!state.timestamp) return;

    // alert 대신 로그인 화면이 완료 안내를 보여준다 (?reset=1)
    if (state.success) {
      router.push('/login?reset=1');
    }
  }, [state.timestamp, state.success, router]);

  return (
    <React.Fragment>
      <Form
        className="flex flex-col gap-4"
        action={formAction}
        validationErrors={state.fieldErrors}
      >
        {/* 비밀번호 찾기 성공 메시지는 리다이렉트로 사라지므로, 코드를 어디로 보냈는지 여기서 알린다 */}
        {currentEmail && !resendState.timestamp && (
          <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">
            {currentEmail}
            {' '}
            로 6자리 인증코드를 보냈습니다. 코드와 새 비밀번호를 입력해주세요.
          </div>
        )}

        {state.message && !state.success && (
          <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {state.message}
          </div>
        )}

        {resendState.message && (
          <div className={`p-3 rounded-lg text-sm ${resendState.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
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

        <Controller
          control={control}
          name="password"
          render={({ field: { name, value, onChange } }) => (
            <TextField
              name={name}
              value={value}
              onChange={onChange}
              isRequired
            >
              <Label>새 비밀번호</Label>
              <Input variant="secondary" type="password" placeholder="8자 이상" />
              <FieldError />
            </TextField>
          )}
        />

        <Controller
          control={control}
          name="passwordConfirm"
          render={({ field: { name, value, onChange } }) => (
            <TextField
              name={name}
              value={value}
              onChange={onChange}
              isRequired
            >
              <Label>새 비밀번호 확인</Label>
              <Input variant="secondary" type="password" placeholder="비밀번호 재입력" />
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
          비밀번호 변경
        </Button>
      </Form>

      <div className="mt-4">
        <Form action={resendAction}>
          <input type="hidden" name="email" value={currentEmail} />
          <Button type="submit" variant="ghost" isPending={isResending} className="w-full">
            인증코드 다시 받기
          </Button>
        </Form>
      </div>

      <div className="mt-6 text-center text-sm">
        <Link href="/login" className="text-gray-500 hover:text-gray-700">
          로그인으로 돌아가기
        </Link>
      </div>
    </React.Fragment>
  );
}
