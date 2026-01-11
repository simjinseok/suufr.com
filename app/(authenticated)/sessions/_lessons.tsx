'use client';
import { CircleCheckBigIcon, CircleIcon } from 'lucide-react';
import { fromDate, now } from '@internationalized/date';
import { format } from 'date-fns/format';

import React from 'react';
import {
  Button,
  ListBox,
} from '@heroui/react';
import LessonModal from '@/components/lesson-modal';
import dayjs from 'dayjs';

export default function Lessons({ lessons }) {
  const [editingLesson, setEditingLesson] = React.useState(null);

  return (
    <React.Fragment>
      <ListBox
        className="mt-5"
        aria-label="수업 목록"
        items={lessons}
        renderEmptyState={() => (
          <p>수업이 없어요</p>
        )}
      >
        {lesson => (
          <ListBox.Item id={lesson.id} textValue={lesson.id} className="flex items-start">
            <div>
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
            </div>
            <p>{lesson.syllabus.student.name}</p>
            <div className="tabular-nums">
              {dayjs(lesson.lessonAt).format('YYYY-MM-DD hh:mm')}
            </div>
            <p className="whitespace-pre-wrap text-gray-500">
              {lesson.notes}
            </p>
          </ListBox.Item>
        )}
      </ListBox>
      {/*<LessonModal*/}
      {/*  isOpen={editingLesson !== null}*/}
      {/*  onClose={() => { setEditingLesson(null); }}*/}
      {/*  lesson={editingLesson}*/}
      {/*/>*/}
    </React.Fragment>
  );
}
