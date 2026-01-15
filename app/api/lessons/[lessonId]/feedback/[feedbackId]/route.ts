import { getSession } from '@/utils/auth';
import prisma from '@/utils/prisma';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ lessonId: string; feedbackId: string }> },
) {
  const { feedbackId: _feedbackId } = await params;
  const feedbackId = Number(_feedbackId);

  const session = await getSession();

  if (!session?.user) {
    return new Response('', { status: 401 });
  }

  const feedback = await prisma.feedback.findUnique({
    where: {
      id: feedbackId,
      session: {
        lesson: {
          student: {
            userId: session.user.id,
          },
        },
      },
      deletedAt: null,
    },
  });

  if (!feedback) {
    return new Response('', { status: 404 });
  }

  const formData = await request.formData();

  const result = await prisma.feedback.update({
    where: {
      id: feedback.id,
    },
    data: {
      notes: formData.get('notes') as string,
    },
  });

  return Response.json(result, { status: 200 });
}
