import { getSession } from '@/utils/auth';
import prisma from '@/utils/prisma';
import type { StudentStatus } from '@/prisma/generated/enums';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const cursor = searchParams.get('cursor');
  const limit = Number(searchParams.get('limit')) || 10;

  const session = await getSession();

  if (!session?.user) {
    return new Response('', { status: 401 });
  }

  const students = await prisma.student.findMany({
    where: {
      userId: session.user.id,
      deletedAt: null,
      ...(search && {
        name: {
          contains: search,
          mode: 'insensitive',
        },
      }),
    },
    orderBy: {
      name: 'asc',
    },
    take: limit + 1,
    ...(cursor && {
      cursor: {
        id: Number(cursor),
      },
      skip: 1,
    }),
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  const hasMore = students.length > limit;
  const items = hasMore ? students.slice(0, limit) : students;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  return Response.json({
    items,
    nextCursor,
  });
}

export async function POST(req: Request) {
  const session = await getSession();

  if (!session?.user) {
    return new Response('', { status: 401 });
  }

  const formData = await req.formData();

  const result = await prisma.student.create({
    data: {
      userId: session.user.id,
      name: formData.get('name') as string,
      status: formData.get('status') as StudentStatus,
      notes: formData.get('notes') as string,
    },
  });

  return Response.json(
    { ...result },
    { status: 201 },
  );
}
