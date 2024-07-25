import type { TStudent } from "@/types/index";

import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";
import { clsx } from "clsx";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/button";
import { Heading } from "@/components/heading";
import StatusBadge from "@/components/status-badge";
import ConditionForm from "./_condition-form";
import NewStudent from "./_new-student";
import Edit from './_edit';
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/table";
import React from "react";

const PAGE_SIZE = 20;
type PageProps = {
  searchParams: {
    page: number;
    status: string;
    edit: string;
  };
};
export default async function Page({ searchParams }: PageProps) {
  const page = searchParams.page > 0 ? Number(searchParams.page) : 1;
  const status = typeof searchParams.status === 'string' ? searchParams.status : "active";

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
             CAST(COUNT(*) FILTER (WHERE lessons.is_done = false AND lessons.deleted_at IS NULL) AS INT) AS "upcomingLessonsCount"
      FROM students
               LEFT JOIN syllabuses ON syllabuses.student_id = students.id
               LEFT JOIN lessons ON lessons.syllabus_id = syllabuses.id
      WHERE (${status} = '' OR students.status = ${status})
        AND students.user_id = ${user.id}::uuid AND students.deleted_at IS NULL
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

  const editingStudent = searchParams.edit
    ? students.find((m) => m.id === Number(searchParams.edit))
    : null;

  return (
    <div className="mt-3">
      <Heading className="text-2xl font-bold">수강생 목록</Heading>
      <div className="mt-5 flex justify-between">
        <ConditionForm currentStatus={status} />

        <div>
          <NewStudent />
        </div>
      </div>
        <Table className="mt-5">
            <TableHead>
                <TableRow>
                    <TableHeader>이름</TableHeader>
                    <TableHeader>상태</TableHeader>
                    <TableHeader>남은수업</TableHeader>
                    <TableHeader>계획</TableHeader>
                    <TableHeader>수업</TableHeader>
                    <TableHeader>입금내역</TableHeader>
                    <TableHeader>수정</TableHeader>
                </TableRow>
            </TableHead>
            <TableBody>
                {students.length > 0 ? (
                    <>
                        {students.map((student: any) => (
                            <TableRow key={`student-${student.id}`}>
                                <TableCell>
                                    {student.name}
                                </TableCell>
                                <TableCell><StatusBadge status={student.status} /></TableCell>
                                <TableCell className={clsx(
                                    "text-lg font-bold",
                                    (student.upcomingLessonsCount as number) > 0
                                        ? "text-green-500"
                                        : "",
                                )}>{student.upcomingLessonsCount}회</TableCell>
                                <TableCell>
                                    <Link href={`/syllabuses?student=${student.id}`}>
                                        <Button>계획 목록</Button>
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    <Link href={`/lessons?student=${student.id}`}>
                                        <Button>수업 목록</Button>
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    <Link href={`/payments?student=${student.id}`}>
                                        <Button>입금내역</Button>
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    <Link
                                        href={{
                                            query: {
                                                ...searchParams,
                                                edit: student.id,
                                            },
                                        }}
                                    >
                                        <Button plain>수정</Button>
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))}
                    </>
                ) : (
                    <TableRow>
                        <TableCell className="text-center" colSpan={6}>
                            수강생이 없어요
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
      <div className="mt-5 flex justify-between">
        {page > 1 && (
          <Link
            className="flex items-center"
            href={{
              query: {
                page: page - 1,
                status: status,
              },
            }}
          >
            <ChevronLeftIcon />
            이전 페이지
          </Link>
        )}
        {(studentCount > (page * PAGE_SIZE)) && (
          <Link
            className="flex items-center"
            href={{
              query: {
                page: page + 1,
                status: status,
              },
            }}
          >
            다음 페이지
            <ChevronRightIcon />
          </Link>
        )}
      </div>
        {editingStudent && (
            <Edit
                student={editingStudent}
            />
        )}
    </div>
  );
}
