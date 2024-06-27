"use server";
import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const supabase = createClient();

export async function newStudentAction(prevState: any, formData: FormData) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      message: "로그인이 필요합니다",
    };
  }

  const name = formData.get("name");
  if (typeof name !== "string") {
    return {
      message: "이름을 입력해주세요",
    };
  }

  const notes = formData.get("notes");
  if (typeof notes !== "string") {
    return {
      message: "잘못된 접근입니다.",
    };
  }

  const result = await prisma.student.create({
    data: {
      userId: user.id,
      name,
      notes,
    },
  });

  console.log('학생 추가', result);
  return;
}
