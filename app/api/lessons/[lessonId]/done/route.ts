import { createClient } from "@/utils/supabase";
import { prisma } from '@/utils/prisma';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId: _lessonId } = await params;
  const lessonId = Number(_lessonId);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("", {
      status: 401,
    });
  }

  const lesson = await prisma.lesson.findUnique({
    where: {
      id: lessonId,
      deletedAt: null,
      syllabus: {
        student: {
          userId: user.id,
        },
      },
    },
  });

  if (!lesson) {
    return new Response("", {
      status: 404,
    });
  }

  const result = await prisma.lesson.update({
    where: {
      id: lesson.id,
    },
    data: {
      isDone: !lesson.isDone,
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
