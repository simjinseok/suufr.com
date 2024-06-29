import type { TStudent } from "@/types/index";

import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";
import { clsx } from "clsx";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/button";
import { Badge } from "@/components/badge";
import { Heading } from "@/components/heading";
import { Text } from "@/components/text";
import ConditionForm from "./_condition-form";
import NewStudent from "./_new-student";

const PAGE_SIZE = 10;
type PageProps = {
  searchParams: {
    page: number;
    status: string;
  };
};
export default async function Page({ searchParams }: PageProps) {
  const page = searchParams.page > 0 ? Number(searchParams.page) : 1;
  const status = searchParams.status || "";

  const prisma = new PrismaClient();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const students: TStudent[] = await prisma.$queryRaw`
      SELECT students.id                                                  AS id,
             students.name                                                AS name,
             students.notes                                               AS notes,
             students.status                                              AS status,
             CAST(COUNT(*) FILTER (WHERE lessons.is_done = false) AS INT) AS "upcomingLessonsCount"
      FROM students
               LEFT JOIN syllabuses ON syllabuses.student_id = students.id
               LEFT JOIN lessons ON lessons.syllabus_id = syllabuses.id
      WHERE (${status} = '' OR students.status = ${status}) AND students.user_id = ${user.id}
      GROUP BY students.id, students.name, students.notes
      ORDER BY students.name ASC
      OFFSET ${(page - 1) * PAGE_SIZE} LIMIT ${PAGE_SIZE};
  `;

  const studentCount: number = await prisma.student.count({
    where: {
      deletedAt: null,
      userId: user.id,
    },
  });

  return (
    <div className="mt-3">
      <Heading className="text-2xl font-bold">수강생 목록</Heading>
      <div className="mt-5 flex justify-between">
        <ConditionForm />

        <div>
          <NewStudent />
        </div>
      </div>
      <ul className="mt-3 divide-y">
        {students.map((student) => (
          <li
            key={`student-${student.id}`}
            className="flex justify-between py-5"
          >
            <div className="grow">
              <p className="text-xl font-bold">
                {student.name}
                <Badge
                  color={
                    student.status === "active"
                      ? "green"
                      : student.status === "paused"
                        ? "yellow"
                        : "red"
                  }
                >
                  {student.status === "active"
                    ? "수강중"
                    : student.status === "paused"
                      ? "일시정지"
                      : "그만둠"}
                </Badge>
              </p>
              <Text className="whitespace-pre-wrap">{student.notes}</Text>
            </div>
            <div className="shrink-0 flex items-start gap-3">
              <div className="shrink-0 text-center">
                <p>남은 수업</p>
                <p
                  className={clsx(
                    "text-lg font-bold",
                    (student.upcomingLessonsCount as number) > 0
                      ? "text-green-500"
                      : "",
                  )}
                >
                  {student.upcomingLessonsCount}회
                </p>
              </div>
              <Link
                className="shrink-0"
                href={{
                  pathname: `/students/${student.id}`,
                }}
              >
                <Button color="zinc">상세보기</Button>
              </Link>
            </div>
          </li>
        ))}
      </ul>
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
        {studentCount > page * PAGE_SIZE && (
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
    </div>
  );
}
