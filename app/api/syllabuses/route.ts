import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";

export async function POST(req: Request) {
  const prisma = new PrismaClient();
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("", {
      status: 401,
    });
  }

  const formData = await req.formData();
  const studentId = Number(formData.get("studentId"));
  const student = await prisma.student.findUnique({
    where: {
      id: studentId,
      userId: user.id,
      deletedAt: null,
    },
  });

  if (!student) {
    return new Response("", {
      status: 404,
    });
  }

  const result = await prisma.syllabus.create({
    data: {
      title: (formData.get("title") as string) || "",
      notes: (formData.get("notes") as string) || "",
      studentId: student.id,
    },
  })


  return new Response("", {
    status: 201,
  });
}
