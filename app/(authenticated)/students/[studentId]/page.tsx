import { createClient } from '@/utils/supabase';
import { prisma } from '@/utils/prisma';

import Student from './_student';

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import Breadcrumbs from './_breadcrumbs';
import { Card, CardBody, CardHeader } from '@heroui/react';
import Syllabus from '@/components/syllabus';
import { UserIcon } from 'lucide-react';
import Comments from './_comments';

export default async function Page({ params }) {
  const { studentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/login');
  }

  const student = await prisma.student.findUnique({
    select: {
      id: true,
      name: true,
      status: true,
      notes: true,
    },
    where: {
      id: Number(studentId),
      userId: user.id,
    },
  });

  if (!student) {
    return notFound();
  }

  const syllabus = await prisma.syllabus.findFirst({
    select: {
      title: true,
      notes: true,
      payment: {
        select: {
          amount: true,
          paymentMethod: true,
          notes: true,
          paidAt: true,
        },
      },
      lessons: {
        select: {
          id: true,
          isDone: true,
          lessonAt: true,
          notes: true,
          feedback: {
            select: {
              notes: true,
            },
          },
        },
        orderBy: {
          lessonAt: 'desc',
        },
      },
    },
    where: {
      studentId: student.id,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  const comments = await prisma.studentComment.findMany({
    select: {
      id: true,
      content: true,
      createdAt: true,
    },
    where: {
      studentId: student.id,
      deletedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(comments);

  return (

    <div>
      <Breadcrumbs studentName={student.name} />

      <div className="grid grid-cols-3 gap-x-6">
        <div className="col-span-2 flex flex-col gap-6">
          <div>
            <Card>
              <CardHeader className="justify-between">
                <h3 className="text-lg font-bold">최근 계획</h3>
                <Link href={`/syllabuses?student=${student.id}`}>전체 계획 보기</Link>
              </CardHeader>
              <CardBody>
                {syllabus ? (
                  <Syllabus
                    syllabus={syllabus}
                  />
                ) : (
                  <p>생성한 계획이 없습니다</p>
                )}
              </CardBody>
            </Card>
          </div>

          <Comments
            comments={comments}
          />
        </div>

        <div className="col-span-1">
          <Student student={student} />
        </div>
      </div>
    </div>
  );
}
