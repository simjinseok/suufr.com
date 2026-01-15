import { getSession } from '@/utils/auth';
import prisma from '@/utils/prisma';
import FeedbackSchema from '@/schemas/feedback';

export async function POST(
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

  const formData = await request.formData();
  const schemaData = FeedbackSchema.parse(formData);

  const feedback = await prisma.feedback.findUnique({
    where: {
      sessionId: lesson.id,
    },
  });

  let feedbackResult;
  if (feedback) {
    feedbackResult = await prisma.feedback.update({
      where: {
        id: feedback.id,
      },
      data: {
        notes: schemaData.notes,
        deletedAt: null,
      },
    });
  }
  else {
    feedbackResult = await prisma.feedback.create({
      data: {
        sessionId: lesson.id,
        notes: schemaData.notes || '',
      },
    });
  }

  return Response.json(feedbackResult, { status: 201 });
}
