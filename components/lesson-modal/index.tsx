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

interface Props {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  lesson: any;
  syllabus?: any;
}
export default function LessonModal({ isOpen, setIsOpen, lesson, syllabus }: Props) {
  return (
    <Modal isOpen={isOpen} onOpenChange={setIsOpen}>
      <ModalContent>
        {onClose => (
          <>
            <ModalHeader className="flex flex-col gap-1">레슨 정보 수정</ModalHeader>
            <ModalBody>
              <Form id="payment-form">
                {syllabus && (
                  <input type="hidden" name="syllabusId" value={syllabus.id} />
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
                  hideTimeZone
                  defaultValue={
                    lesson ? fromDate(lesson.lessonAt) : now()
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
              <Button color="primary" onPress={onClose}>
                저장
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
