import { PrismaClient } from "@prisma/client";
import { createClient } from "@/utils/supabase";
import PaymentSchema from "@/schemas/payment";

export async function PUT(
  request: Request,
  { params }: { params: { syllabusId: string } },
) {
  const syllabusId = Number(params.syllabusId);

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

  const syllabus = await prisma.syllabus.findUnique({
    where: {
      id: syllabusId,
      deletedAt: null,
      student: {
        userId: user.id,
      },
    },
  });

  if (!syllabus) {
    return new Response("", {
      status: 404,
    });
  }

  const formData = await request.formData();
  const schemaData = PaymentSchema.parse(formData);

  let payment = await prisma.payment.findUnique({
    where: {
      syllabusId: syllabus.id,
    },
  });

  if (payment) {
    payment = await prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        amount: schemaData.amount,
        paidAt: `${schemaData.paidAt}T00:00:00+09:00`,
        paymentMethod: schemaData.paymentMethod,
        notes: schemaData.notes,
        deletedAt: null,
        updatedAt: new Date(),
      },
    });
  } else {
    payment = await prisma.payment.create({
      data: {
        amount: schemaData.amount,
        paidAt: `${schemaData.paidAt}T00:00:00+09:00`,
        notes: schemaData.notes,
        paymentMethod: schemaData.paymentMethod,
        syllabusId: syllabus.id,
      },
    });
  }

  return Response.json(
    {
      // id: result.id,
    },
    {
      status: 200,
    },
  );
}
