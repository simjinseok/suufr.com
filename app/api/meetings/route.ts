import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";
import MeetingSchema from "@/schemas/meeting";

export async function POST(req: Request) {
  const prisma = new PrismaClient();
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("", {
      status: 401,
    });
  }

  const formData = await req.formData();
  const schemaData = MeetingSchema.parse(formData);

  const result = await prisma.meeting.create({
    data: {
      name: schemaData.name,
      phone: schemaData.phone,
      isDone: schemaData.isDone,
      meetingAt: schemaData.meetingAt,
      notes: schemaData.notes,
      userId: user.id,
    },
  });

  return Response.json(
    {},
    {
      status: 201,
    },
  );
}
