'use client';
import React from 'react';
import Link from 'next/link';
import {
  addToast,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
} from '@heroui/react';
import StatusBadge from '@/components/status-badge';
import { clsx } from 'clsx';
import StudentModal from '@/components/student-modal';

export default function Students({ students }) {
  const [editingStudent, setEditingStudent] = React.useState(null);

  return (
    <React.Fragment>
      <Table className="mt-5" aria-label="수강생 목록">
        <TableHeader>
          <TableColumn>이름</TableColumn>
          <TableColumn>상태</TableColumn>
          <TableColumn>남은수업</TableColumn>
          <TableColumn>계획</TableColumn>
          <TableColumn>수업</TableColumn>
          <TableColumn>입금내역</TableColumn>
          <TableColumn>수정</TableColumn>
        </TableHeader>
        <TableBody>
          {students.length > 0
            ? (
                <>
                  {students.map((student: any) => (
                    <TableRow key={`student-${student.id}`}>
                      <TableCell>
                        <Link href={`/students/${student.id}`}>
                          {student.name}
                        </Link>
                      </TableCell>
                      <TableCell><StatusBadge status={student.status} /></TableCell>
                      <TableCell className={clsx(
                        'text-lg font-bold',
                        (student.upcomingLessonsCount as number) > 0
                          ? 'text-green-500'
                          : '',
                      )}
                      >
                        {student.upcomingLessonsCount}
                        회
                      </TableCell>
                      <TableCell>
                        <Link href={`/syllabuses?student=${student.id}`}>
                          <Button>계획 목록</Button>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Button as={Link} href={`/lessons?student=${student.id}`}>수업 목록</Button>
                      </TableCell>
                      <TableCell>
                        <Link href={`/payments?student=${student.id}`}>
                          <Button>입금내역</Button>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Button variant="light" onPress={() => setEditingStudent(student)}>수정</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )
            : (
                <TableRow>
                  <TableCell className="text-center" colSpan={7}>
                    수강생이 없어요
                  </TableCell>
                </TableRow>
              )}
        </TableBody>
      </Table>
      <StudentModal
        isOpen={editingStudent !== null}
        onClose={() => { setEditingStudent(null); }}
        student={editingStudent}
        action={() => console.log('fefe')}
      />
    </React.Fragment>
  );
}
