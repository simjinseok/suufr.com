import { PrismaClient } from "@prisma/client";
import { createClient } from "@/utils/supabase";
import FeedbackSchema from "@/schemas/feedback";

export async function PUT(
  request: Request,
  { params }: { params: { lessonId: string; feedbackId: string } },
) {
  const feedbackId = Number(params.feedbackId);

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

  const feedback = await prisma.feedback.findUnique({
    where: {
      id: feedbackId,
      lesson: {
        syllabus: {
          student: {
            userId: user.id,
          },
        }
      },
      deletedAt: null,
    },
  });

  if (!feedback) {
    return new Response("", {
      status: 404,
    });
  }

  const formData = await request.formData();

  const result = await prisma.feedback.update({
    where: {
      id: feedback.id,
    },
    data: {
      notes: formData.get("notes") as string,
    },
  });

  return Response.json(result, {
    status: 200,
  });
}
