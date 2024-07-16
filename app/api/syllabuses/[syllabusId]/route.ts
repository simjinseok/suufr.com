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

export async function DELETE(
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
    include: {
      lessons: {
        where: {
          deletedAt: null,
        }
      },
    },
    where: {
      id: syllabusId,
      deletedAt: null,
      student: {
        userId: user.id,
      },
    },
  });
  console.log('이게 없다고?', syllabus);

  if (!syllabus) {
    return new Response("", {
      status: 404,
    });
  }

  if (syllabus.lessons.length > 0) {
      return Response.json({
        message: '모든 레슨을 삭제 후 다시 시도해주세요.'
      }, {
          status: 400,
      });
  }

  const result = await prisma.syllabus.update({
      where: {
          id: syllabus.id,
      },
      data: {
          deletedAt: new Date(),
      },
  });
  console.log(result);

  return new Response(null, { status: 204 });
}
