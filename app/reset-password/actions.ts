"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase";

export async function updatePassword(prevState: any, formData: FormData) {
  const supabase = createClient();

  const password = formData.get("new-password") as string;
  const confirmPassword = formData.get("confirm-password") as string;
  if (password !== confirmPassword) {
    return {
      error: "비밀번호가 일치하지 않습니다.",
    };
  }

  const accessToken = formData.get("access-token") as string;
  const refreshToken = formData.get("refresh-token") as string;

  await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const { error } = await supabase.auth.updateUser({
    password,
  });

  await supabase.auth.signOut();

  if (error) {
    return {
      error: "이메일 혹은 비밀번호가 올바르지 않습니다.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
