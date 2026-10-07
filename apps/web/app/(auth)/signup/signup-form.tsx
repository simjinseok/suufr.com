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
import { RECAPTCHA_ACTION_SIGNUP, RecaptchaNotice, RecaptchaScript, useRecaptcha } from '@/components/auth/recaptcha';

export default function SignupForm({ recaptchaSiteKey }: { recaptchaSiteKey: string | null }) {
  const router = useRouter();
  const { getToken, onScriptError } = useRecaptcha(recaptchaSiteKey);
  // 토큰 발급 동안도 버튼을 pending 으로 보이기 위한 로컬 상태 (useActionState 의 isPending 은 formAction 호출 뒤부터)
  const [isGettingToken, setIsGettingToken] = React.useState(false);
  // onSubmit 가로채기라 React 의 폼 액션 중복 관리가 없다 — 토큰 대기 중 Enter·더블클릭으로 서버 액션이 두 번 가는 것을 막는다.
  // 서버 액션이 돌아오면(state.timestamp 변화) 풀린다
  const submitting = React.useRef(false);

  const [state, formAction, isPending] = React.useActionState(signup, {
    fields: { email: '', password: '', passwordConfirm: '', ...EMPTY_CONSENTS },
  });

  const [consents, setConsents] = React.useState<ConsentValues>(EMPTY_CONSENTS);

  // 서버 액션 실패 후 체크 상태 복원
  React.useEffect(() => {
    if (!state.timestamp || state.success || !state.fields) return;
    setConsents({
      agreeTerms: state.fields.agreeTerms,
      agreePrivacy: state.fields.agreePrivacy,
    });
  }, [state.timestamp, state.success, state.fields]);

  const { control } = useForm({
    values: {
      email: state.fields?.email || '',
      password: '',
      passwordConfirm: '',
    },
  });

  React.useEffect(() => {
    if (!state.timestamp) return;
    submitting.current = false;

    // 가입 즉시 로그인 → 바로 앱으로. 이메일 인증은 설정(회원정보)에서 나중에 한다. 인증 화면으로는 보내지 않는다
    if (state.loggedIn) router.push('/dashboard');
  }, [state.timestamp, state.loggedIn, router]);

  // HeroUI Form 의 action= 대신 onSubmit 으로 가로채, reCAPTCHA 토큰을 받은 뒤 서버 액션을 transition 안에서 호출한다.
  // 토큰을 못 받아도 제출은 진행한다 — 막을지는 api 의 RECAPTCHA_MODE 가 정한다
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const formData = new FormData(event.currentTarget);
    setIsGettingToken(true);
    try {
      const token = await getToken(RECAPTCHA_ACTION_SIGNUP);
      if (token) formData.set('recaptchaToken', token);
    }
    finally {
      setIsGettingToken(false);
    }
    React.startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50">
      {recaptchaSiteKey && <RecaptchaScript siteKey={recaptchaSiteKey} onError={onScriptError} />}
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
          onSubmit={handleSubmit}
          validationErrors={state.fieldErrors}
        >
          {state.message && !state.success && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {state.message}
            </div>
          )}
          {/* 토큰 없는 200 = 이미 가입된 이메일(열거 방지 합성 응답). 안내만 하고 머문다 */}
          {state.success && !state.loggedIn && (
            <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">
              {state.message}
              {' '}
              이미 가입된 이메일이라면 로그인해주세요.
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
            isPending={isPending || isGettingToken}
            isDisabled={!isAllConsented(consents)}
            className="w-full mt-2"
          >
            가입하기
          </Button>
          <p className="text-center text-xs text-gray-400">가입하면 만 14세 이상임을 확인하는 것입니다.</p>
          {recaptchaSiteKey && <RecaptchaNotice />}
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
