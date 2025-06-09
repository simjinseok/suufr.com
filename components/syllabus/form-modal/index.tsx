'use client';
import React from 'react';
import { Form, Input, Modal, ModalContent, ModalBody, ModalHeader, Textarea, ModalFooter, Button } from '@heroui/react';

import removeStudent from '@/actions/remove-student';
import { updateSyllabus } from '@/actions/update-syllabus';
import { createSyllabus } from '@/actions/create-syllabus';

export default function SyllabusModal({ student, syllabus, isOpen, onClose, onSave }) {
  const formId = React.useId();

  const [isPending, startTransition] = React.useTransition();

  const onSubmit = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    startTransition(async () => {
      const result = syllabus ? await updateSyllabus(formData) : await createSyllabus(formData);
      if (result.success) {
        onSave(result);
        onClose();
      }
    });
  }, [syllabus]);

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <ModalContent>
        {onClose => (
          <React.Fragment>
            <ModalHeader>{syllabus ? '계획 수정' : '계획 추가'}</ModalHeader>
            <ModalBody>
              <Form
                id={formId}
                onSubmit={onSubmit}
              >
                {student && (<input type="hidden" name="studentId" value={student.id} />)}
                {syllabus && (<input type="hidden" name="syllabusId" value={syllabus.id} />)}
                <Input name="title" label="제목" defaultValue={syllabus?.title} />
                <Textarea name="notes" label="메모" defaultValue={syllabus?.notes} />
              </Form>
            </ModalBody>
            <ModalFooter>
              {syllabus && (
                <Button
                  color="danger"
                  variant="light"
                  onPress={() => {
                    if (confirm('수강생을 삭제합니다')) {
                      const formData = new FormData();
                      formData.set('studentId', student.id);
                      startTransition(async () => {
                        const result = await removeStudent(formData);
                        if (result.success) {
                          onClose();
                        }
                      });
                    }
                  }}
                >
                  삭제
                </Button>
              )}
              <div className="grow" />
              <Button variant="light" disabled={isPending} onPress={onClose}>
                닫기
              </Button>
              <Button
                form={formId}
                color="primary"
                type="submit"
                isLoading={isPending}
              >
                저장
              </Button>
            </ModalFooter>
          </React.Fragment>
        )}
      </ModalContent>
    </Modal>
  );
}
