import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";

export async function PUT(
  request: Request,
  { params }: { params: { studentId: string } },
) {
  const studentId = Number(params.studentId);

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

  const formData = await request.formData();
  console.log("여길 안와?");
  for (const field of formData.entries()) {
    console.log("???", field[1]);
  }

  const result = await prisma.student.update({
    where: {
      id: student.id,
    },
    data: {
      name: formData.get("name") as string,
      notes: formData.get("notes") as string,
    },
  });

  return Response.json(
    {
      id: result.id,
      name: result.name,
      notes: result.notes,
    },
    {
      status: 200,
    },
  );
}
