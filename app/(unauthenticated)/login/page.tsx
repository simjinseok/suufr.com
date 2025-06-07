'use client';
import * as React from 'react';
import Link from 'next/link';
import { login } from './actions';
import { Button, Form, Input } from '@heroui/react';

export default function Page() {
  const [state, action, isPending] = React.useActionState<any, any>(login, {});

  return (
    <Form action={action}>
      <Input type="text" label="이메일" name="email" placeholder="admin@suufr.com" />
      <Input type="password" label="비밀번호" name="password" placeholder="비밀번호" />

      {state?.error && <p className="mt-3 text-red-500">{state.error}</p>}
      <Button type="submit" isLoading={isPending} color="primary" className="w-full" disabled={isPending}>로그인</Button>
      <Link className="mt-5" href="/signup">
        회원가입
      </Link>
    </Form>
  );
}
