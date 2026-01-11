import { getSession } from '@/utils/auth';
import prisma from '@/utils/prisma';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId: _lessonId } = await params;
  const lessonId = Number(_lessonId);

  const session = await getSession();

  if (!session?.user) {
    return new Response('', { status: 401 });
  }

  const lesson = await prisma.lesson.findUnique({
    where: {
      id: lessonId,
      deletedAt: null,
      syllabus: {
        student: {
          userId: session.user.id,
        },
      },
    },
  });

  if (!lesson) {
    return new Response('', { status: 404 });
  }

  const formData = await request.formData();
  const lessonAt = new Date(`${formData.get('lessonAt')}:00+09:00`);

  const result = await prisma.lesson.update({
    where: {
      id: lesson.id,
    },
    data: {
      isDone: formData.get('isDone') === 'on',
      notes: formData.get('notes') as string,
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
    { status: 200 },
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId: _lessonId } = await params;
  const lessonId = Number(_lessonId);

  const session = await getSession();

  if (!session?.user) {
    return new Response('', { status: 401 });
  }

  const lesson = await prisma.lesson.findUnique({
    where: {
      id: lessonId,
      deletedAt: null,
      syllabus: {
        student: {
          userId: session.user.id,
        },
      },
    },
  });

  if (!lesson) {
    return new Response('', { status: 404 });
  }

  await prisma.lesson.update({
    where: {
      id: lesson.id,
    },
    data: {
      deletedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return new Response(null, { status: 204 });
}
