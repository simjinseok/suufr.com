import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";

import Lessons from './_lessons';

export default async function Page() {
  const prisma = new PrismaClient();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const lessons = await prisma.lesson.findMany({
    include: {
      student: true
    },
    where: {
      student: {
        userId: user.id,
      },
      deletedAt: null,
    },
    orderBy: [
      {
        lessonAt: "desc",
      },
    ],
  });

  return <div>
    <Lessons lessons={lessons} />
  </div>;
}
