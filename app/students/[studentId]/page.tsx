import type { TStudent } from "@/types/index";

import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";
import { commaizeNumber } from "@toss/utils";

import React from "react";
import { redirect } from "next/navigation";
import { Heading } from "@/components/heading";
import { Text } from "@/components/text";
import Syllabuses from "./_syllabuses";

export default async function Page({
  params,
}: { params: { studentId: string } }) {
  const prisma = new PrismaClient();
  const studentId = Number(params.studentId);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const students: TStudent[] = await prisma.$queryRaw`
      SELECT students.id                                                 AS id,
             students.name                                               AS name,
             students.notes                                              AS notes,
             CAST(COUNT(*) FILTER (WHERE lessons.is_done = false) AS INT) AS "upcomingLessonsCount"
      FROM students
               LEFT JOIN syllabuses ON syllabuses.student_id = students.id
               LEFT JOIN lessons ON lessons.syllabus_id = syllabuses.id
      WHERE students.id = ${studentId}
        AND students.deleted_at IS NULL
        AND students.user_id = ${user.id}::uuid
      GROUP BY students.id, students.name, students.notes;
  `;
  const student = students[0];

  if (!student) {
    return { notFound: true };
  }

  const syllabuses = await prisma.syllabus.findMany({
    take: 5,
    include: {
      payment: {
        where: {
          deletedAt: null,
        },
      },
      lessons: {
        where: {
          deletedAt: null,
        },
        orderBy: {
          lessonAt: "asc",
        },
      },
    },
    where: {
      studentId: student.id,
      deletedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <Heading>{student.name}</Heading>
        <div className="flex gap-5">
          <div className="text-center">
            <Text>남은 수업</Text>
            <p className="font-bold text-lg">
              {commaizeNumber(Number(student.upcomingLessonsCount))}회
            </p>
          </div>
        </div>
      </div>
      <Text className="whitespace-pre-wrapii">{student.notes}</Text>
      {/*
      // @ts-ignore */}
      <Syllabuses syllabuses={syllabuses} student={student} />
    </div>
  );
}
