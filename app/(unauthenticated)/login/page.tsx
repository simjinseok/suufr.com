'use client';
import * as React from 'react';
import { login } from './actions';
import { Button, Form, Input } from '@heroui/react';
import Link from "next/link";
// import { Button } from '@/components/button';
// import { FieldGroup, Field, Label } from '@/components/fieldset';
// import { Input } from '@/components/input';

export default function Page() {
  // const [isPending, startTransition] = React.useTransition();
  const [state, action, isPending] = React.useActionState<any, any>(login, {});

  return (
    <Form action={action}>
      <Input type="text" label="이메일" name="email" placeholder="admin@suufr.com" />
      <Input type="password" label="비밀번호" name="password" placeholder="비밀번호" />

      {state?.error && <p className="mt-3 text-red-500">{state.error}</p>}
      <Button type="submit" color="primary" className="w-full" disabled={isPending}>로그인</Button>
      <Link className="mt-5" href="/signup">
        회원가입
      </Link>
    </Form>
  );
}
