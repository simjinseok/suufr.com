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

  const student = await prisma.student.findUnique({
    where: {
      id: studentId,
      deletedAt: null,
      userId: user.id,
    },
  });

  if (!student) {
    return { notFound: true };
  }

  const remainLessons = await prisma.lesson.count({
    where: {
      studentId: student.id,
      deletedAt: null,
      feedback: null,
    },
  });

  const doneLessons = await prisma.lesson.count({
    where: {
      studentId: student.id,
      deletedAt: null,
      feedback: {
        id: {
          gt: 0,
        },
      },
    },
  });

  const lessons = await prisma.lesson.findMany({
    include: {
      feedback: true,
      student: true,
    },
    where: {
      studentId: student.id,
      deletedAt: null,
    },
    orderBy: {
      lessonAt: "desc",
    },
  });

  const payments = await prisma.payment.findMany({
    where: {
      studentId: student.id,
      deletedAt: null,
    },
    orderBy: {
      paidAt: "desc",
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
              {commaizeNumber(remainLessons)}회
            </p>
          </div>
          <div className="text-center">
            <Text>완료한 수업</Text>
            <p className="font-bold text-lg">{commaizeNumber(doneLessons)}회</p>
          </div>
        </div>
      </div>
      <Text>{student.notes}</Text>
      <Lessons lessons={lessons} />
      <Payments student={student} payments={payments} />
    </div>
  );
}
