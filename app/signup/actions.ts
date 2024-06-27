"use server";
import { createClient } from "@/utils/supabase";
import { redirect } from "next/navigation";

export async function signUp(prevState: any, formData: FormData) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: {
      emailRedirectTo: "https://example.com/welcome",
    },
  });

  redirect('/');
}
