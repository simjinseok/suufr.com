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
          organizationId: session.organization.id,
        },
      },
    },
  });

  if (!lesson) {
    return new Response('', { status: 404 });
  }

  const formData = await request.formData();
  const sessionAt = new Date(`${formData.get('sessionAt')}:00+09:00`);

  const result = await prisma.session.update({
    where: {
      id: lesson.id,
    },
    data: {
      isDone: formData.get('isDone') === 'on',
      notes: formData.get('notes') as string,
      sessionAt,
      updatedAt: new Date(),
    },
  });

  return Response.json(
    {
      id: result.id,
      sessionAt: result.sessionAt,
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

  const lesson = await prisma.session.findUnique({
    where: {
      id: lessonId,
      deletedAt: null,
      lesson: {
        student: {
          organizationId: session.organization.id,
        },
      },
    },
  });

  if (!lesson) {
    return new Response('', { status: 404 });
  }

  await prisma.session.update({
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
