import type { TStudent } from "@/types/index";

import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";

import { redirect } from "next/navigation";
import { Heading } from "@/components/heading";
import Lessons from "./_lessons";
import Payments from "./_payments";
import { Text } from "@/components/text";
import React from "react";
import { commaizeNumber } from "@toss/utils";

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
      SELECT students.id                                                     AS id,
             students.name                                                   AS name,
             students.notes                                                  AS notes,
             CAST(COUNT(*) FILTER (WHERE lessons.lesson_at > CURRENT_DATE) AS INT) as "upcomingLessonsCount"
      FROM students
        LEFT JOIN lessons ON lessons.student_id = students.id
      WHERE students.id = ${studentId}
        AND students.deleted_at IS NULL
        AND students.user_id = ${user.id}::uuid
      GROUP BY students.id, students.name, students.notes;
  `;
  const student = students[0];

  if (!student) {
    return { notFound: true };
  }
  const [lessons, payments] = await prisma.$transaction([
    prisma.lesson.findMany({
      take: 10,
      include: {
        feedback: true,
      },
      where: {
        studentId: student.id,
        deletedAt: null,
      },
      orderBy: {
        lessonAt: "desc",
      },
    }),
    prisma.payment.findMany({
      take: 10,
      where: {
        studentId: student.id,
        deletedAt: null,
      },
      select: {
        id: true,
        paidAt: true,
        amount: true,
        notes: true,
      },
      orderBy: {
        paidAt: "desc",
      },
    }),
  ]);

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
      <Lessons lessons={lessons} />
      <Payments student={student} payments={payments} />
    </div>
  );
}
