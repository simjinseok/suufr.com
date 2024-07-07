import type { TMeeting } from "@/types/index";

import { PrismaClient } from "@prisma/client";
import { createClient } from "@/utils/supabase";

import React from "react";
import { Heading } from "@/components/heading";
import Link from "next/link";
import NewMeeting from "./_new-meeting";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/table";
import { format } from "date-fns/format";
import { Button } from "@/components/button";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleCheckBigIcon,
  CircleIcon,
} from "lucide-react";
import Edit from "./_edit";

const PAGE_SIZE = 20;
export default async function Page({ searchParams }: any) {
  const page = searchParams.page > 0 ? Number(searchParams.page) : 1;

  const prisma = new PrismaClient();
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("", {
      status: 401,
    });
  }

  const meetings: TMeeting[] = await prisma.meeting.findMany({
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      isDone: true,
      phone: true,
      notes: true,
      meetingAt: true,
    },
    where: {
      userId: user.id,
      deletedAt: null,
    },
    orderBy: {
      meetingAt: "desc",
    },
  });
  const meetingsCount = await prisma.meeting.count({
    where: {
      userId: user.id,
      deletedAt: null,
    },
  });

  const editingMeeting = searchParams.edit
    ? meetings.find((m) => m.id === Number(searchParams.edit))
    : null;

  return (
    <div>
      <Heading className="text-2xl font-bold">상담 내역</Heading>
      <NewMeeting />
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>연락여부</TableHeader>
            <TableHeader>일자</TableHeader>
            <TableHeader>이름</TableHeader>
            <TableHeader>연락처</TableHeader>
            <TableHeader>노트</TableHeader>
            <TableHeader>수정</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {meetings.map((meeting) => (
            <TableRow key={`payment-${meeting.id}`}>
              <TableCell>
                {meeting.isDone ? (
                  <Button plain>
                    <CircleCheckBigIcon
                      width={20}
                      height={20}
                      className="text-green-600"
                    />
                  </Button>
                ) : (
                  <Button plain>
                    <CircleIcon
                      width={20}
                      height={20}
                      className="text-amber-500"
                    />
                  </Button>
                )}
              </TableCell>
              <TableCell>{format(meeting.meetingAt, "yyyy-MM-dd")}</TableCell>
              <TableCell>{meeting.name}</TableCell>
              <TableCell>{meeting.phone}</TableCell>
              <TableCell className="whitespace-pre">{meeting.notes}</TableCell>
              <TableCell>
                <Link
                  href={{
                    query: {
                      edit: meeting.id,
                    },
                  }}
                >
                  수정
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
        {meetingsCount > page * PAGE_SIZE && (
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
      {editingMeeting && <Edit meeting={editingMeeting} />}
    </div>
  );
}
