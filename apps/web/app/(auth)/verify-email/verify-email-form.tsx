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

import { resendVerification, verifyEmail } from '@/actions/auth';

export default function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get('email') || '';
  // 가입·로그인에서 인증코드 메일 발송에 실패해 넘어온 경우
  const mailFailed = searchParams.get('mailFailed') === '1';

  const [state, formAction, isPending] = React.useActionState(verifyEmail, {
    fields: { email: emailFromQuery, code: '' },
  });

  const [resendState, resendAction, isResending] = React.useActionState(resendVerification, { fields: { email: emailFromQuery } });

  const { control, watch } = useForm({
    values: {
      email: state.fields?.email || emailFromQuery,
      code: '',
    },
  });

  const currentEmail = state.fields?.email || emailFromQuery;
  // 재발송은 지금 입력칸의 이메일로 보낸다(주소창에 ?email 없이 들어와 직접 입력한 경우)
  const typedEmail = watch('email') || currentEmail;

  React.useEffect(() => {
    if (!state.timestamp || !state.success) return;

    // 인증과 함께 로그인됐으면 바로 앱으로. 아니면(이미 인증됐거나 2단계 인증 계정) 로그인 화면이 완료 안내를 보여준다
    router.push(state.loggedIn ? '/dashboard' : '/login?verified=1');
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
            인증코드 메일을 보내지 못했습니다. 아래 &quot;인증코드 다시 받기&quot;를 눌러주세요.
          </div>
        )}

        {/* 가입·로그인에서 넘어온 경우(?email)에만 이미 보냈다고 안내한다 */}
        {emailFromQuery && !mailFailed && !resendState.timestamp && (
          <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">
            {emailFromQuery}
            {' '}
            로 6자리 인증코드를 보냈습니다.
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
                autoFocus
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
          <input type="hidden" name="email" value={typedEmail} />
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
