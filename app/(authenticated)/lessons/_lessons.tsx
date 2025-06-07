'use client';
import { CircleCheckBigIcon, CircleIcon } from 'lucide-react';
import { fromDate, now } from '@internationalized/date';
import { format } from 'date-fns/format';

import React from 'react';
import {
  Button,
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
} from '@heroui/react';
import LessonModal from '@/components/lesson-modal';

export default function Lessons({ lessons }) {
  const [editingLesson, setEditingLesson] = React.useState(null);

  return (
    <React.Fragment>
      <Table className="mt-5" aria-label="레슨 목록">
        <TableHeader>
          <TableColumn>완료여부</TableColumn>
          <TableColumn>수강생</TableColumn>
          <TableColumn>수업일자</TableColumn>
          <TableColumn>메모</TableColumn>
          <TableColumn>수정</TableColumn>
        </TableHeader>
        <TableBody>
          {lessons.length > 0
            ? (
                <>
                  {lessons.map((lesson: any) => (
                    <TableRow key={`lesson-${lesson.id}`}>
                      <TableCell>
                        {lesson.isDone
                          ? (
                              <CircleCheckBigIcon
                                width={20}
                                height={20}
                                className="text-green-600"
                              />
                            )
                          : (
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
                        {format(lesson.lessonAt, 'yyyy-MM-dd HH:mm')}
                      </TableCell>
                      <TableCell>
                        {lesson.notes}
                      </TableCell>
                      <TableCell>
                        <Button onPress={() => setEditingLesson(lesson)}>수정</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )
            : (
                <TableRow>
                  <TableCell className="text-center" colSpan={6}>
                    수업이 없어요
                  </TableCell>
                </TableRow>
              )}
        </TableBody>
      </Table>
      <LessonModal
        isOpen={editingLesson !== null}
        onClose={() => { setEditingLesson(null); }}
        lesson={editingLesson}
      />
    </React.Fragment>
  );
}
