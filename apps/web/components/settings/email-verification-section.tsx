'use client';
import * as React from 'react';
import { Button, FieldError, Form, Input, Label, Surface, TextField } from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';
import { MailWarning } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { resendVerification, verifyEmail } from '@/actions/auth';

/**
 * 설정(회원정보)의 이메일 인증 섹션. 가입 직후 로그인된 미인증 계정만 보인다.
 * 가입 메일의 6자리 코드를 입력하거나 다시 받는다. 성공하면 서버 컴포넌트를 다시 그려(/me emailVerified) 섹션과 상단 배너가 함께 사라진다.
 */
export default function EmailVerificationSection({ email }: { email: string }) {
  const router = useRouter();

  const [state, formAction, isPending] = React.useActionState(verifyEmail, { fields: { email, code: '' } });
  const [resendState, resendAction, isResending] = React.useActionState(resendVerification, { fields: { email } });

  const { control } = useForm({ values: { code: '' } });

  React.useEffect(() => {
    if (!state.timestamp || !state.success) return;
    router.refresh();
  }, [state.timestamp, state.success, router]);

  return (
    <Surface className="p-5 border border-amber-200 bg-amber-50/40 rounded-xl shadow-xs">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <MailWarning className="w-5 h-5 text-amber-600" />
        이메일 인증
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        {email}
        {' '}
        으로 보낸 6자리 인증코드를 입력하세요.
      </p>

      <Form className="mt-4 flex flex-col gap-3" action={formAction} validationErrors={state.fieldErrors}>
        <input type="hidden" name="email" value={email} />

        {state.message && !state.success && (
          <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{state.message}</div>
        )}
        {state.success && (
          <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">{state.message}</div>
        )}
        {resendState.message && (
          <div className={`p-3 rounded-lg text-sm ${resendState.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {resendState.message}
          </div>
        )}

        <Controller
          control={control}
          name="code"
          render={({ field: { name, value, onChange } }) => (
            <TextField name={name} value={value} onChange={onChange} isRequired className="max-w-xs">
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

        <div className="flex gap-2">
          <Button type="submit" variant="primary" size="sm" isPending={isPending}>인증하기</Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            isPending={isResending}
            onClick={() => {
              const data = new FormData();
              data.set('email', email);
              React.startTransition(() => resendAction(data));
            }}
          >
            인증코드 다시 받기
          </Button>
        </div>
      </Form>
    </Surface>
  );
}
