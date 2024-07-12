"use client";
import { useFormState } from "react-dom";
import { login } from "./actions";
import { Button } from "@/components/button";
import { FieldGroup, Field, Label } from "@/components/fieldset";
import { Input } from "@/components/input";

export default function Page() {
  const [state, action, isPending] = useFormState<any, any>(login, {});

  return (
    <form action={action}>
      <FieldGroup>
        <Field>
          <Label>이메일</Label>
          <Input type="text" name="email" placeholder="admin@suufr.com" />
        </Field>

        <Field>
          <Label>비밀번호</Label>
          <Input type="password" name="password" />
        </Field>

      </FieldGroup>
      {state?.error && <p className="mt-3 text-red-500">{state.error}</p>}
      <Button type="submit" disabled={isPending}>로그인</Button>
      <Button className="mt-5" href="/signup">
        회원가입
      </Button>
    </form>
  );
}
