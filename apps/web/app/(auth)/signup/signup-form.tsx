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

import { signup } from '@/actions/auth';
import ConsentCheckboxes, { EMPTY_CONSENTS, isAllConsented, type ConsentValues } from '@/components/auth/consent-checkboxes';

export default function SignupForm() {
  const router = useRouter();

  const [state, formAction, isPending] = React.useActionState(signup, {
    fields: { name: '', email: '', password: '', passwordConfirm: '', ...EMPTY_CONSENTS },
  });

  const [consents, setConsents] = React.useState<ConsentValues>(EMPTY_CONSENTS);

  // 서버 액션 실패 후 체크 상태 복원
  React.useEffect(() => {
    if (!state.timestamp || state.success || !state.fields) return;
    setConsents({
      agreeTerms: state.fields.agreeTerms,
      agreePrivacy: state.fields.agreePrivacy,
      agreeOverseasTransfer: state.fields.agreeOverseasTransfer,
    });
  }, [state.timestamp, state.success, state.fields]);

  const { control } = useForm({
    values: {
      name: state.fields?.name || '',
      email: state.fields?.email || '',
      password: '',
      passwordConfirm: '',
    },
  });

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      const email = state.fields?.email || '';
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    }
  }, [state.timestamp, state.success, state.fields?.email, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <span className="text-2xl font-bold text-white">스</span>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">회원가입</h1>
          <p className="mt-2 text-sm text-gray-500">스프에 오신 것을 환영합니다</p>
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
            name="name"
            render={({ field: { name, value, onChange } }) => (
              <TextField
                name={name}
                value={value}
                onChange={onChange}
                isRequired
              >
                <Label>이름</Label>
                <Input variant="secondary" type="text" placeholder="홍길동" />
                <FieldError />
              </TextField>
            )}
          />

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
            name="password"
            render={({ field: { name, value, onChange } }) => (
              <TextField
                name={name}
                value={value}
                onChange={onChange}
                isRequired
              >
                <Label>비밀번호</Label>
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
                <Label>비밀번호 확인</Label>
                <Input variant="secondary" type="password" placeholder="비밀번호 재입력" />
                <FieldError />
              </TextField>
            )}
          />

          <ConsentCheckboxes values={consents} onChange={setConsents} errors={state.fieldErrors} />

          <Button
            type="submit"
            variant="primary"
            isPending={isPending}
            isDisabled={!isAllConsented(consents)}
            className="w-full mt-2"
          >
            가입하기
          </Button>
          <p className="text-center text-xs text-gray-400">가입하면 만 14세 이상임을 확인하는 것입니다.</p>
        </Form>

        <div className="mt-6 text-center text-sm text-gray-500">
          이미 계정이 있으신가요?
          {' '}
          <Link
            href="/login"
            className="text-violet-600 hover:text-violet-700 font-medium"
          >
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}
