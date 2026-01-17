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

import { forgotPassword } from '@/actions/auth';

export default function ForgotPasswordForm() {
  const router = useRouter();

  const [state, formAction, isPending] = React.useActionState(forgotPassword, {
    fields: { email: '' },
  });

  const { control } = useForm({
    values: {
      email: state.fields?.email || '',
    },
  });

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      const email = state.fields?.email || '';
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    }
  }, [state.timestamp, state.success, state.fields?.email, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <span className="text-2xl font-bold text-white">스</span>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            비밀번호 찾기
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            가입한 이메일을 입력해주세요
          </p>
        </div>

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

          <Button
            type="submit"
            variant="primary"
            isPending={isPending}
            className="w-full mt-2"
          >
            인증코드 받기
          </Button>
        </Form>

        <div className="mt-6 text-center text-sm">
          <Link href="/login" className="text-gray-500 hover:text-gray-700">
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
