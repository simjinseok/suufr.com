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
import { formatToKoreanNumber } from "@toss/utils";
import Link from "next/link";
import { TextLink } from "@/components/text";
import React from "react";
import { format } from "date-fns/format";
import { Tab } from "@headlessui/react";

export default async function Page() {
  const prisma = new PrismaClient();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const notCheckedLessons = await prisma.lesson.findMany({
    include: {
      syllabus: {
        include: {
          student: true,
        },
      },
    },
    where: {
      lessonAt: {
        lte: new Date(),
      },
      isDone: false,
      deletedAt: null,
      syllabus: {
        deletedAt: null,
        student: {
          userId: user.id,
        },
      },
    },
  });

  const currentActiveStudentCount = await prisma.student.count({
    where: {
      userId: user.id,
      deletedAt: null,
      status: "active",
    },
  });

  const remainLessonsCount = await prisma.lesson.count({
    where: {
      syllabus: {
        student: {
          userId: user.id,
        },
      },
      deletedAt: null,
    },
  });

  const notPaidSyllabuses = await prisma.syllabus.findMany({
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

  const notDoneMeetings = await prisma.meeting.findMany({
    where: {
      isDone: false,
      deletedAt: null,
      userId: user.id,
    },
    orderBy: {
      meetingAt: "asc",
    },
  });

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
            <p className="font-bold text-2xl">{notPaidSyllabuses.length}건</p>
          </div>
        </div>
      </div>

      {notCheckedLessons.length > 0 && (
        <div className="mt-12">
          <Heading level={2}>완료가 필요한 레슨</Heading>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>학생명</TableHeader>
                <TableHeader>일자</TableHeader>
                <TableHeader>메모</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {notCheckedLessons.map((lesson) => (
                <TableRow key={`syllabus-${lesson.id}`}>
                  <TableCell>{lesson.syllabus.student.name}</TableCell>
                  <TableCell>
                    {format(lesson.lessonAt, "yyyy-MM-dd HH:mm")}
                  </TableCell>
                  <TableCell className="whitespace-pre-wrap">
                    {lesson.notes}
                  </TableCell>
                  {/*<TableCell>*/}
                  {/*  <Link*/}
                  {/*    passHref*/}
                  {/*    legacyBehavior*/}
                  {/*    href={`/syllabuses/${lesson.id}`}*/}
                  {/*  >*/}
                  {/*    <TextLink href="">상세보기</TextLink>*/}
                  {/*  </Link>*/}
                  {/*</TableCell>*/}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {notPaidSyllabuses.length > 0 && (
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
              {notPaidSyllabuses.map((syllabus) => (
                <TableRow key={`syllabus-${syllabus.id}`}>
                  <TableCell>{syllabus.student.name}</TableCell>
                  <TableCell>{syllabus.title}</TableCell>
                  {/*<TableCell>*/}
                  {/*  <Link*/}
                  {/*    passHref*/}
                  {/*    legacyBehavior*/}
                  {/*    href={`/syllabuses/${lesson.id}`}*/}
                  {/*  >*/}
                  {/*    <TextLink href="">상세보기</TextLink>*/}
                  {/*  </Link>*/}
                  {/*</TableCell>*/}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {notDoneMeetings.length > 0 && (
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
              {notDoneMeetings.map((meeting) => (
                <TableRow key={`meeting-${meeting.id}`}>
                  <TableCell>
                    {format(meeting.meetingAt, "yyyy-MM-dd")}
                  </TableCell>
                  <TableCell>{meeting.name}</TableCell>
                  <TableCell>{meeting.phone}</TableCell>
                  <TableCell className="whitespace-pre-wrap">{meeting.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
