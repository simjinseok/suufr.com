import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";

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

  const result = await prisma.student.create({
    data: {
      userId: user.id,
      name: formData.get("name") as string,
      notes: formData.get("notes") as string,
    },
  });

  return Response.json(
    { ...result },
    {
      status: 201,
    },
  );
}
