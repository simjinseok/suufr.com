import { getSession } from '@/utils/auth';
import prisma from '@/utils/prisma';
import MeetingSchema from '@/schemas/meeting';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId: _meetingId } = await params;
  const meetingId = Number(_meetingId);

  const session = await getSession();

  if (!session?.user) {
    return new Response('', { status: 401 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: {
      id: meetingId,
      organizationId: session.organization.id,
      deletedAt: null,
    },
  });

  if (!meeting) {
    return new Response('', { status: 404 });
  }

  const formData = await request.formData();
  const schemaData = MeetingSchema.parse(formData);
  const result = await prisma.meeting.update({
    where: {
      id: meeting.id,
    },
    data: {
      name: schemaData.name,
      phone: schemaData.phone,
      notes: schemaData.notes,
      isDone: schemaData.isDone,
      meetingAt: schemaData.meetingAt,
    },
  });

  return Response.json(
    { id: result.id },
    { status: 200 },
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId: _meetingId } = await params;
  const meetingId = Number(_meetingId);

  const session = await getSession();

  if (!session?.user) {
    return new Response('', { status: 401 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: {
      id: meetingId,
      organizationId: session.organization.id,
      deletedAt: null,
    },
  });

  if (!meeting) {
    return new Response('', { status: 404 });
  }

  await prisma.meeting.update({
    where: {
      id: meeting.id,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  return new Response(null, { status: 204 });
}
