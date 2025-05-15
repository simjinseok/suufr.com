'use client';
import React from 'react';
import {
  Button,
  Checkbox,
  DatePicker,
  Form,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
} from '@heroui/react';
import { fromDate, now } from '@internationalized/date';
import { updateLesson } from '../../actions/update-lesson';
import { createLesson } from '../../actions/create-lesson';

interface Props {
  isOpen: boolean;
  onClose: (isOpen: boolean) => void;
  lesson: any;
  syllabus?: any;
}
export default function LessonModal({ isOpen, onClose, lesson, syllabus }: Props) {
  const formId = React.useId();

  const onSubmit = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    const result = lesson ? await updateLesson(formData) : await createLesson(formData);
    console.log(result);
  }, [lesson]);

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <ModalContent>
        {onClose => (
          <>
            <ModalHeader className="flex flex-col gap-1">{lesson ? '레슨 수정' : '레슨 추가'}</ModalHeader>
            <ModalBody>
              <Form id={formId} onSubmit={onSubmit}>
                {syllabus && (
                  <input type="hidden" name="syllabusId" value={syllabus.id} />
                )}
                {lesson && (
                  <input type="hidden" name="lessonId" value={lesson.id} />
                )}
                {lesson && (
                  <Checkbox name="isDone" defaultSelected={lesson.isDone}>
                    완료여부
                  </Checkbox>
                )}
                <DatePicker
                  className="mt-4"
                  label="날짜"
                  name="lessonAt"
                  granularity="minute"
                  hideTimeZone
                  defaultValue={
                    lesson ? fromDate(lesson.lessonAt, 'asia/seoul') : now('asia/seoul')
                  }
                />
                <Textarea
                  className="mt-4"
                  name="notes"
                  label="메모"
                  defaultValue={lesson?.notes}
                />
              </Form>
            </ModalBody>
            <ModalFooter>
              <Button
                color="danger"
                variant="light"
                onPress={() => {
                  if (confirm('레슨을 삭제합니다')) {

                  }
                }}
              >
                삭제
              </Button>
              <div className="grow" />
              <Button variant="light" onPress={onClose}>
                닫기
              </Button>
              <Button type="submit" form={formId} color="primary" onPress={onClose}>
                저장
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
