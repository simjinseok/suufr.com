import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";
import PaymentSchema from "@/schemas/payment";

export async function PUT(
  request: Request,
  { params }: { params: { paymentId: string } },
) {
  const paymentId = Number(params.paymentId);

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

  const payment = await prisma.payment.findUnique({
    where: {
      id: paymentId,
      deletedAt: null,
      syllabus: {
        student: {
          userId: user.id,
        },
      },
    },
  });

  if (!payment) {
    return new Response("", {
      status: 404,
    });
  }

  const formData = await request.formData();
  const schemaData = PaymentSchema.parse(formData);

  const result = await prisma.payment.update({
    where: {
      id: payment.id,
    },
    data: {
      paidAt: new Date(schemaData.paidAt),
      amount: schemaData.amount,
      notes: schemaData.notes,
      paymentMethod: schemaData.paymentMethod,
      updatedAt: new Date(),
    },
  });

  return Response.json(result, {
    status: 200,
  });
}
