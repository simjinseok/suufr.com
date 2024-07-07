import { PrismaClient } from "@prisma/client";
import { createClient } from "@/utils/supabase";

export async function PUT(
  request: Request,
  { params }: { params: { lessonId: string } },
) {
  const lessonId = Number(params.lessonId);

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

  const formData = await request.formData();
  const lessonAt = new Date(`${formData.get("lessonAt")}:00+09:00`);

  const result = await prisma.lesson.update({
    where: {
      id: lesson.id,
    },
    data: {
      notes: formData.get("notes") as string,
      lessonAt,
      updatedAt: new Date(),
    },
  });

  return Response.json(
    {
      id: result.id,
      lessonAt: result.lessonAt,
      notes: result.notes,
    },
    {
      status: 200,
    },
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: { lessonId: string } },
) {
  const lessonId = Number(params.lessonId);

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
      deletedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return new Response(null, {
    status: 204,
  });
}
