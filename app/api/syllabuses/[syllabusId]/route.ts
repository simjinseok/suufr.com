import { PrismaClient } from "@prisma/client";
import { createClient } from "@/utils/supabase";

export async function PUT(
  request: Request,
  { params }: { params: { syllabusId: string } },
) {
  const syllabusId = Number(params.syllabusId);

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

  const syllabus = await prisma.syllabus.findUnique({
    where: {
      id: syllabusId,
      deletedAt: null,
      student: {
        userId: user.id,
      },
    },
  });

  if (!syllabus) {
    return new Response("", {
      status: 404,
    });
  }

  const formData = await request.formData();

  const result = await prisma.syllabus.update({
    where: {
      id: syllabus.id,
    },
    data: {
      title: formData.get("title") as string,
      notes: formData.get("notes") as string,
      updatedAt: new Date(),
    },
  });

  return Response.json(
    {
      id: result.id,
    },
    {
      status: 200,
    },
  );
}
