import { getSession } from '@/utils/auth';
import prisma from '@/utils/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const studentId = Number(searchParams.get('studentId'));

  const session = await getSession();

  if (!session?.user) {
    return new Response('', { status: 401 });
  }

  const student = await prisma.student.findUnique({
    where: {
      id: studentId,
      userId: session.user.id,
      deletedAt: null,
    },
  });

  if (!student) {
    return new Response('', { status: 404 });
  }

  const lessons = await prisma.session.findMany({
    where: {
      lesson: {
        studentId: student.id,
      },
      deletedAt: null,
    },
    orderBy: [
      {
        sessionAt: 'desc',
      },
    ],
  });

  return Response.json(lessons, { status: 200 });
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session?.user) {
    return new Response('', { status: 401 });
  }

  const formData = await request.formData();
  const lessonId = Number(formData.get('lessonId'));
  const lesson = await prisma.lesson.findUnique({
    where: {
      id: lessonId,
      deletedAt: null,
      student: {
        userId: session.user.id,
      },
    },
  });

  if (!lesson) {
    return new Response('', { status: 404 });
  }

  const dates = formData.getAll('sessionAt');
  if (dates.length === 1) {
    const sessionAt = new Date(`${dates[0]}:00+09:00`);

    const newSession = await prisma.session.create({
      data: {
        lessonId: lesson.id,
        notes: formData.get('notes') as string,
        sessionAt,
      },
    });

    return Response.json(newSession, { status: 201 });
  }

  if (dates.length > 1) {
    const results = await prisma.session.createMany({
      data: dates.map((date) => {
        return {
          lessonId: lesson.id,
          notes: '',
          sessionAt: `${date}:00+09:00`,
        };
      }),
    });

    return Response.json(results, { status: 201 });
  }
}
