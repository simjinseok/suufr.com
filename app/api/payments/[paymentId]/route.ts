import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";

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
      student: {
        userId: user.id,
      },
    },
  });

  if (!payment) {
    return new Response("", {
      status: 404,
    });
  }

  const formData = await request.formData();
  console.log("여길 안와?");
  for (const field of formData.entries()) {
    console.log("???", field[1]);
  }

  const result = await prisma.payment.update({
    where: {
      id: payment.id,
    },
    data: {
      amount: Number(formData.get("amount")),
      notes: formData.get("notes") as string,
    },
  });

  return Response.json(result, {
    status: 200,
  });
}
