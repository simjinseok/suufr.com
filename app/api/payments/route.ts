import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { zfd } from "zod-form-data";

const schema = zfd.formData({
  studentId: zfd.numeric(z.number().min(1)),
  amount: zfd.numeric(
    z
      .number({ message: "금액을 입력해주세요." })
      .min(1, { message: "금액은 1원 이상이어야 합니다." }),
  ),
  notes: zfd.text(z.optional(z.string())),
  paidAt: zfd.text(z.string().date()),
});

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
  const schemaResult = schema.parse(formData);
  console.log("gdgd", schemaResult);
  const studentId = formData.get("studentId");

  const student = await prisma.student.findUnique({
    where: {
      id: schemaResult.studentId,
      userId: user.id,
      deletedAt: null,
    },
  });

  if (!student) {
    return new Response("", {
      status: 404,
    });
  }

  const result = await prisma.payment.create({
    data: {
      studentId: student.id,
      paidAt: `${schemaResult.paidAt}T00:00:00+09:00`,
      amount: schemaResult.amount,
      notes: schemaResult.notes || null,
    },
  });

  return Response.json(
    { ...result },
    {
      status: 201,
    },
  );
}
