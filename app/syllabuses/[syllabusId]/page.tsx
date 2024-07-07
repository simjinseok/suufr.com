import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

export default async function Page({
  params,
}: { params: { syllabusId: string } }) {
  const syllabusId = Number(params.syllabusId);
  if (Number.isNaN(syllabusId)) {
    return notFound();
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const prisma = new PrismaClient();
  const syllabus = await prisma.syllabus.findUnique({
    select: {
      id: true,
      title: true,
      notes: true,
      student: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      payment: {
        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          notes: true,
          paidAt: true,
        }
      }
    },
    where: {
      id: syllabusId,
      student: {
        userId: user.id,
      },
    },
  });

  if (!syllabus) {
    return notFound();
  }

  return <div>ff</div>;
}
