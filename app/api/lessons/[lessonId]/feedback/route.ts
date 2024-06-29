import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";
import FeedbackSchema from "@/schemas/feedback";

export async function POST(
  request: Request,
  { params }: { params: { lessonId: string } },
) {
  const lessonId = Number(params.lessonId);

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

  const lesson = await prisma.lesson.findUnique({
    where: {
      id: lessonId,
      deletedAt: null,
      syllabus: {
        student: {
          userId: user.id,
        },
      },
    },
  });

  if (!lesson) {
    return new Response("", {
      status: 404,
    });
  }

  const formData = await request.formData();
  const schemaData = FeedbackSchema.parse(formData);

  // 피드백이 deletedAt이면 찾아서 null로 바꿔주어야함
  const feedback = await prisma.feedback.findUnique({
    where: {
      lessonId: lesson.id,
    },
  });

  let feedbackResult: any;
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
  } else {
    feedbackResult = await prisma.feedback.create({
      data: {
        lessonId: lesson.id,
        notes: schemaData.notes || "",
      },
    });
  }

  return Response.json(feedbackResult, { status: 201 });
}
