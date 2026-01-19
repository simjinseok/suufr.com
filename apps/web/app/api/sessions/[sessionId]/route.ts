import { getSession } from '@/utils/auth';
import prisma from '@/utils/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId: _sessionId } = await params;
  const sessionId = Number(_sessionId);

  const session = await getSession();

  if (!session?.organization) {
    return new Response('', { status: 401 });
  }

  const currentSession = await prisma.session.findUnique({
    where: {
      id: sessionId,
      deletedAt: null,
      lesson: {
        deletedAt: null,
        student: {
          organizationId: session.organization.id,
          deletedAt: null,
        },
      },
    },
    select: {
      id: true,
      sessionAt: true,
      isDone: true,
      notes: true,
      feedback: {
        select: {
          notes: true,
        },
      },
      lesson: {
        select: {
          id: true,
          title: true,
          student: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!currentSession) {
    return new Response('', { status: 404 });
  }

  const previousSessions = await prisma.session.findMany({
    where: {
      deletedAt: null,
      sessionAt: {
        lt: currentSession.sessionAt,
      },
      lesson: {
        deletedAt: null,
        student: {
          id: currentSession.lesson.student.id,
          deletedAt: null,
        },
      },
    },
    select: {
      id: true,
      sessionAt: true,
      isDone: true,
      notes: true,
      feedback: {
        select: {
          notes: true,
        },
      },
    },
    orderBy: {
      sessionAt: 'desc',
    },
    take: 3,
  });

  return Response.json({
    current: {
      id: currentSession.id,
      sessionAt: currentSession.sessionAt.toISOString(),
      isDone: currentSession.isDone,
      notes: currentSession.notes,
      feedback: currentSession.feedback?.notes || null,
      lessonTitle: currentSession.lesson.title,
      studentName: currentSession.lesson.student.name,
    },
    previousSessions: previousSessions.map(s => ({
      id: s.id,
      sessionAt: s.sessionAt.toISOString(),
      isDone: s.isDone,
      notes: s.notes,
      feedback: s.feedback?.notes || null,
    })),
  });
}
