"use server";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase";

export async function login(prevState: any, formData: FormData) {
  const supabase = createClient();
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  console.log('gdgdgd', error);
  if (error) {
    return {
        error: '이메일 혹은 비밀번호가 올바르지 않습니다.',
    }
  }

  redirect("/");
}
