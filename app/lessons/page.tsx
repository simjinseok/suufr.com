import {createClient} from "@/utils/supabase";
import {PrismaClient} from "@prisma/client";
import {format} from "date-fns/format";
import {redirect} from "next/navigation";

import React from "react";
import Link from "next/link";
import {ChevronLeftIcon, ChevronRightIcon, CircleCheckBigIcon, CircleIcon} from "lucide-react";
import {
    DescriptionDetails,
    DescriptionList,
    DescriptionTerm,
} from "@/components/description-list";
import {Heading} from "@/components/heading";
import {
    Table,
    TableHead,
    TableHeader,
    TableBody,
    TableCell,
    TableRow,
} from "@/components/table";

import EditLesson from './_edit';
import {Button} from "@/components/button";
import Filter from "./_filter";

const PAGE_SIZE = 30;
export default async function Page({
                                       searchParams,
                                   }: {
    searchParams: { student: string; from: string, to: string, edit: string, page: string }
}) {
    const prisma = new PrismaClient();
    const supabase = createClient();
    const {
        data: {user},
    } = await supabase.auth.getUser();

    if (!user) {
        return redirect("/login");
    }

    const page = Number(searchParams.page) > 0 ? Number(searchParams.page) : 1;
    const studentId = Number(searchParams.student);
    const from = searchParams.from ? new Date(searchParams.from) : new Date(0);
    const to = searchParams.to ? new Date(searchParams.to) : new Date(2040, 1, 1);
    const where = {
        deletedAt: null,
        ...(from ? {
            lessonAt: {
                gte: from,
                lte: to,
            },
        } : {}),
        syllabus: {
            student: {
                ...(studentId ? {id: studentId} : {}),
                userId: user.id,
            },
        },
    }
    const lessons = await prisma.lesson.findMany({
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
        select: {
            id: true,
            lessonAt: true,
            notes: true,
            isDone: true,
            syllabus: {
                select: {
                    student: {
                        select: {
                            id: true,
                            name: true,
                            notes: true,
                        }
                    }
                }
            }
        },
        where,
        orderBy: {
            lessonAt: "desc",
        },
    });

    const lessonsCount = await prisma.lesson.count({
        where,
    });

    const editingLesson = searchParams.edit
        ? lessons.find((l) => l.id === Number(searchParams.edit))
        : null;

    return (
        <div>
            <Heading level={1}>수업</Heading>
            <div className="mt-6">
                <Filter/>
            </div>
            {lessons.length > 0 && (
                <div className="mt-3">
                    <Heading level={3}>요약</Heading>
                    <DescriptionList>
                        <DescriptionTerm>결제 건수</DescriptionTerm>
                        <DescriptionDetails>건</DescriptionDetails>

                        <DescriptionTerm>결제 금액</DescriptionTerm>
                        <DescriptionDetails>
                        </DescriptionDetails>
                    </DescriptionList>
                </div>
            )}
            <Table className="mt-5">
                <TableHead>
                    <TableRow>
                        <TableHeader>완료여부</TableHeader>
                        <TableHeader>수강생</TableHeader>
                        <TableHeader>수업일자</TableHeader>
                        <TableHeader>메모</TableHeader>
                        <TableHeader>수정</TableHeader>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {lessons.length > 0 ? (
                        <>
                            {lessons.map((lesson: any) => (
                                <TableRow key={`lesson-${lesson.id}`}>
                                    <TableCell>
                                        {lesson.isDone ? (
                                            <CircleCheckBigIcon
                                                width={20}
                                                height={20}
                                                className="text-green-600"
                                            />
                                        ) : (
                                            <CircleIcon
                                                width={20}
                                                height={20}
                                                className="text-amber-500"
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {lesson.syllabus.student.name}
                                    </TableCell>
                                    <TableCell className="tabular-nums">
                                        {format(lesson.lessonAt, "yyyy-MM-dd HH:mm")}
                                    </TableCell>
                                    <TableCell>
                                        {lesson.notes}
                                    </TableCell>
                                    <TableCell>
                                        <Link
                                            href={{
                                                query: {
                                                    ...searchParams,
                                                    edit: lesson.id,
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
                                수업이 없어요
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            {editingLesson && (
                <EditLesson
                    lesson={editingLesson}
                />
            )}
            <div className="mt-10 flex justify-between">
                <div>
                    {page > 1 && (
                        <Link
                            className="flex items-center"
                            href={{
                                query: {
                                    ...searchParams,
                                    page: page - 1,
                                },
                            }}
                        >
                            <ChevronLeftIcon/>
                            이전 페이지
                        </Link>
                    )}
                </div>
                <div>
                    {lessonsCount > page * PAGE_SIZE && (
                        <Link
                            className="flex items-center"
                            href={{
                                query: {
                                    ...searchParams,
                                    page: page + 1,
                                },
                            }}
                        >
                            다음 페이지
                            <ChevronRightIcon/>
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
