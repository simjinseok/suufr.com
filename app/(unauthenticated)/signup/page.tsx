"use client";
import { useFormState } from "react-dom";
import { Button } from "@/components/button";
import { FieldGroup, Field, Label } from "@/components/fieldset";
import { Input } from "@/components/input";
import { signUp } from "./actions";

export default function Page() {
  const [state, action, isPending] = useFormState<any, any>(signUp, {});
  return (
    <form method="POST" action={action}>
      <FieldGroup>
        <Field>
          <Label>이메일</Label>
          <Input type="text" name="email" />
        </Field>

        <Field>
          <Label>비밀번호</Label>
          <Input type="password" name="password" />
        </Field>
      </FieldGroup>

      <div className="mt-5">
        <Button type="submit" className="w-full" disabled={isPending}>
          회원가입
        </Button>
      </div>
    </form>
  );
}
