import { getSession } from '@/utils/auth';
import prisma from '@/utils/prisma';
import type { StudentStatus } from '@/prisma/generated/enums';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ studentUuid: string }> },
) {
  const { studentUuid } = await params;

  const session = await getSession();

  if (!session?.user) {
    return new Response('', { status: 401 });
  }

  const student = await prisma.student.findUnique({
    where: {
      uuid: studentUuid,
      userId: session.user.id,
      deletedAt: null,
    },
  });

  if (!student) {
    return new Response('', { status: 404 });
  }

  const formData = await request.formData();

  const result = await prisma.student.update({
    where: {
      id: student.id,
    },
    data: {
      name: formData.get('name') as string,
      status: formData.get('status') as StudentStatus,
      notes: formData.get('notes') as string,
    },
  });

  return Response.json(
    {
      uuid: result.uuid,
      name: result.name,
      notes: result.notes,
    },
    { status: 200 },
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ studentUuid: string }> },
) {
  const { studentUuid } = await params;

  const session = await getSession();

  if (!session?.user) {
    return new Response('', { status: 401 });
  }

  const student = await prisma.student.findUnique({
    where: {
      uuid: studentUuid,
      userId: session.user.id,
      deletedAt: null,
    },
  });

  if (!student) {
    return new Response('', { status: 404 });
  }

  await prisma.student.update({
    where: {
      id: student.id,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  return new Response(null, { status: 204 });
}
