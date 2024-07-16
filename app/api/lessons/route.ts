import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const studentId = Number(searchParams.get("studentId"));

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

  const lessons = await prisma.lesson.findMany({
    where: {
      syllabus: {
        studentId: student.id,
      },
      deletedAt: null,
    },
    orderBy: [
      {
        lessonAt: "desc",
      },
    ],
  });

  return Response.json(lessons, { status: 200 });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);

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

  const formData = await request.formData();
  const syllabusId = Number(formData.get("syllabusId"));
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


  const dates = formData.getAll("lessonAt");
  if (dates.length === 1) {
    const lessonAt = new Date(`${dates[0]}:00+09:00`);

    const lesson = await prisma.lesson.create({
      data: {
        syllabusId: syllabus.id,
        notes: formData.get("notes") as string,
        lessonAt,
      },
    });

    return Response.json(lesson, { status: 201 });
  }

  if (dates.length > 1) {
    const dates = formData.getAll("lessonAt");
    const results = await prisma.lesson.createMany({
      data: dates.map((date) => {
          return {
              syllabusId: syllabus.id,
              notes: '',
              lessonAt: `${date}:00+09:00`,
          }
      }),
    });

    return Response.json(results, { status: 201});
  }
}
