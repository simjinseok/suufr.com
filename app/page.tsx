import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";
import { redirect } from "next/navigation";
import { Heading } from "@/components/heading";
import { Divider } from "@/components/divider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/table";
import React from "react";
import { format } from "date-fns/format";

const prisma = new PrismaClient();
export default async function Page() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const [
    currentActiveStudentCount,
    remainLessonsCount,
    notPaidSyllabusesCount,
  ] = await Promise.all([
    prisma.student.count({
      where: {
        userId: user.id,
        deletedAt: null,
        status: "active",
      },
    }),
    prisma.lesson.count({
        where: {
            isDone: false,
            syllabus: {
                student: {
                    userId: user.id,
                },
            },
            deletedAt: null,
        },
    }),
    prisma.syllabus.count({
      where: {
        student: {
          userId: user.id,
        },
        deletedAt: null,
        payment: null,
      },
    }),
  ]);

  return (
    <div>
      <Heading>홈</Heading>
      <Divider className="mt-5" />
      <div className="mt-12">
        <Heading level={2}>요약</Heading>
        <div className="mt-5 grid grid-cols-4 gap-x-3">
          <div className="pt-7 border-t">
            <Heading level={3}>수강중인 학생수</Heading>
            <p className="text-green-500 font-bold text-2xl">
              {currentActiveStudentCount}명
            </p>
          </div>

          <div className="pt-7 border-t">
            <Heading level={3}>남은 수업</Heading>
            <p className="font-bold text-2xl">{remainLessonsCount}건</p>
          </div>

          <div className="pt-7 border-t">
            <Heading level={3}>미입금</Heading>
            <p className="font-bold text-2xl">{notPaidSyllabusesCount}건</p>
          </div>
        </div>
      </div>

      <React.Suspense>
        <NotPaidSyllabuses user={user} />
      </React.Suspense>

      <React.Suspense>
        <NotCheckedMeetings user={user} />
      </React.Suspense>
    </div>
  );
}

async function NotPaidSyllabuses({ user }: any) {
  const syllabuses = await prisma.syllabus.findMany({
    include: {
      student: true,
    },
    where: {
      deletedAt: null,
      payment: null,
      student: {
        userId: user.id,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (syllabuses.length < 1) {
    return null;
  }

  return (
    <div className="mt-12">
      <Heading>입금 확인이 필요한 일정</Heading>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>학생명</TableHeader>
            <TableHeader>제목</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {syllabuses.map((syllabus) => (
            <TableRow key={`syllabus-${syllabus.id}`}>
              <TableCell>{syllabus.student.name}</TableCell>
              <TableCell>{syllabus.title}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

async function NotCheckedMeetings({ user }: any) {
  const meetings = await prisma.meeting.findMany({
    where: {
      isDone: false,
      deletedAt: null,
      userId: user.id,
    },
    orderBy: {
      meetingAt: "asc",
    },
  });

  if (meetings.length < 1) {
    return null;
  }

  return (
    <div className="mt-12">
      <Heading>연락이 필요한 상담내역</Heading>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>날짜</TableHeader>
            <TableHeader>이름</TableHeader>
            <TableHeader>연락처</TableHeader>
            <TableHeader>내용</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {meetings.map((meeting) => (
            <TableRow key={`meeting-${meeting.id}`}>
              <TableCell>{format(meeting.meetingAt, "yyyy-MM-dd")}</TableCell>
              <TableCell>{meeting.name}</TableCell>
              <TableCell>{meeting.phone}</TableCell>
              <TableCell className="whitespace-pre-wrap">
                {meeting.notes}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
