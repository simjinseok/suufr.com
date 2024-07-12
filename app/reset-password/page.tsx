"use client";
import { updatePassword } from "./actions";

import React from "react";
import { useFormState } from "react-dom";
import { Field, FieldGroup, Label } from "@/components/fieldset";
import { Input } from "@/components/input";
import { Button } from "@/components/button";
import {notFound, redirect} from "next/navigation";

export default function Page() {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [hash, setHash] = React.useState<any>(null);
  const [state, action, isPending] = useFormState<any, any>(updatePassword, {});

  React.useEffect(() => {
    const hash = window.location.hash.replace("#", "").split("&");
    const  obj: any = {};
    for (const h of hash) {
        const [key, value] = h.split("=");
        obj[key] = value;
    }
    setHash(obj);
    setIsLoaded(true);
  }, []);

  if (!isLoaded) {
    return null;
  }

  if (hash.error) {
    return notFound();
  }

  if (isLoaded && !hash) {
    return notFound();
  }

  return (
    <form action={action}>
      <FieldGroup>
        <Field>
          <input type="hidden" name="access-token" value={hash.access_token} />
          <input type="hidden" name="refresh-token" value={hash.refresh_token} />
          <Label>새로운 비밀번호</Label>
          <Input
            type="password"
            name="new-password"
            autoComplete="new-password"
            placeholder="새로운 비밀번호"
          />
        </Field>

        <Field>
          <Label>비밀번호 확인</Label>
          <Input
            type="password"
            name="confirm-password"
            autoComplete="new-password"
            placeholder="비밀번호 확인"
          />
        </Field>
      </FieldGroup>
      {state.error && <p className="text-red-500">{state.error}</p>}
      <div className="mt-5">
        <Button type="submit" disabled={isPending}>
          비밀번호 변경
        </Button>
      </div>
    </form>
  );
}
