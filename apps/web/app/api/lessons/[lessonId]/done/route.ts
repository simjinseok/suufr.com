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

  const lesson = await prisma.session.findUnique({
    where: {
      id: lessonId,
      deletedAt: null,
      lesson: {
        student: {
          userId: session.user.id,
        },
      },
    },
  });

  if (!lesson) {
    return new Response('', { status: 404 });
  }

  const result = await prisma.session.update({
    where: {
      id: lesson.id,
    },
    data: {
      isDone: !lesson.isDone,
      updatedAt: new Date(),
    },
  });

  return Response.json(
    { id: result.id },
    { status: 200 },
  );
}
