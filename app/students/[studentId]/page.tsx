import type { TStudent } from "@/types/index";

import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";
import { commaizeNumber } from "@toss/utils";

import React from "react";
import { redirect, notFound } from "next/navigation";
import { Heading } from "@/components/heading";
import { Text } from "@/components/text";
import StatusBadge from "@/components/status-badge";
import EditStudentButton from "./_edit-student-button";
import Syllabuses from "./_syllabuses";

const prisma = new PrismaClient();
export default async function Page({
  params,
}: { params: { studentId: string } }) {
  const studentId = Number(params.studentId);
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
             students.status                                              AS status,
             students.notes                                               AS notes,
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
    return notFound();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <Heading>
          {student.name}&nbsp;&nbsp;
          <StatusBadge status={student.status} />
        </Heading>
        <div className="flex gap-5">
          <div className="text-center">
            <Text>남은 수업</Text>
            <p className="font-bold text-lg">
              {commaizeNumber(Number(student.upcomingLessonsCount))}회
            </p>
          </div>
          <EditStudentButton student={student} />
        </div>
      </div>
      <Text className="whitespace-pre-wrap">{student.notes}</Text>
      <React.Suspense>
        <SyllabusList user={user} student={student} />
      </React.Suspense>
    </div>
  );
}

async function SyllabusList({ user, student }: any) {
  const syllabuses = await prisma.syllabus.findMany({
    take: 5,
    select: {
      id: true,
      title: true,
      notes: true,
      payment: {
        select: {
          id: true,
          amount: true,
          notes: true,
          paymentMethod: true,
          paidAt: true,
        },
        where: {
          deletedAt: null,
        },
      },
      lessons: {
        select: {
          id: true,
          notes: true,
          lessonAt: true,
          isDone: true,
          feedback: {
            select: {
              id: true,
              notes: true,
            },
          },
        },
        where: {
          deletedAt: null,
        },
        orderBy: {
          lessonAt: "asc",
        },
      },
    },
    where: {
      student: {
        id: student.id,
        userId: user.id,
      },
      deletedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return <Syllabuses syllabuses={syllabuses} student={student} />;
}
