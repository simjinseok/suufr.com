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
        <Button type="submit">로그인</Button>
      </FieldGroup>
    </form>
  );
}
