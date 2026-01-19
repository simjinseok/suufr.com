import { getSession } from '@/utils/auth';
import prisma from '@/utils/prisma';
import MeetingSchema from '@/schemas/meeting';

export async function POST(req: Request) {
  const session = await getSession();

  if (!session?.organization) {
    return new Response('', { status: 401 });
  }

  const formData = await req.formData();
  const schemaData = MeetingSchema.parse(formData);

  await prisma.meeting.create({
    data: {
      name: schemaData.name,
      phone: schemaData.phone,
      isDone: schemaData.isDone,
      meetingAt: schemaData.meetingAt,
      notes: schemaData.notes,
      userId: session.user.id, // 유지 (추후 제거)
      organizationId: session.organization.id,
    },
  });

  return Response.json({}, { status: 201 });
}
