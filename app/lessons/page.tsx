import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";

import Lessons from "./_lessons";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

const PAGE_SIZE = 20;
export default async function Page({ searchParams }: any) {
  const page = searchParams.page > 0 ? Number(searchParams.page) : 1;

  const prisma = new PrismaClient();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const lessons = await prisma.lesson.findMany({
    skip: (page - 1) * PAGE_SIZE,
    take: 20,
    include: {
      student: true,
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
  const lessonsCount = await prisma.lesson.count({
    where: {
      student: {
        userId: user.id,
      },
      deletedAt: null,
    },
  });

  return (
    <div>
      {Array.isArray(lessons) && lessons.length > 0 ? (
        <>
          <Lessons lessons={lessons} />
          <div className="mt-5 flex justify-between">
            {page > 1 && (
              <Link
                className="flex items-center"
                href={{
                  query: {
                    page: page - 1,
                  },
                }}
              >
                <ChevronLeftIcon />
                이전 페이지
              </Link>
            )}
            {lessonsCount > page * PAGE_SIZE && (
              <Link
                className="flex items-center"
                href={{
                  query: {
                    page: page + 1,
                  },
                }}
              >
                다음 페이지
                <ChevronRightIcon />
              </Link>
            )}
          </div>
        </>
      ) : (
        <p>일정이 없습니다.</p>
      )}
    </div>
  );
}
