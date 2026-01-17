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

import { resetPassword } from '@/actions/auth';

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

  const { control } = useForm({
    values: {
      email: state.fields?.email || emailFromQuery,
      code: '',
      password: '',
      passwordConfirm: '',
    },
  });

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      alert('비밀번호가 재설정되었습니다. 로그인해주세요.');
      router.push('/login');
    }
  }, [state.timestamp, state.success, router]);

  return (
    <React.Fragment>
      <Form
        className="flex flex-col gap-4"
        action={formAction}
        validationErrors={state.fieldErrors}
      >
        {state.message && !state.success && (
          <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {state.message}
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
              <Input type="email" placeholder="email@example.com" />
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
              <Input type="password" placeholder="8자 이상" />
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
              <Input type="password" placeholder="비밀번호 재입력" />
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

      <div className="mt-6 text-center text-sm">
        <Link href="/login" className="text-gray-500 hover:text-gray-700">
          로그인으로 돌아가기
        </Link>
      </div>
    </React.Fragment>
  );
}
