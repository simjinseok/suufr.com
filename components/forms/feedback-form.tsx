'use client';
import { format } from 'date-fns/format';

import * as React from 'react';
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Textarea } from '@heroui/react';
import { FieldGroup, Field, Label } from '@/components/fieldset';
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from '@/components/description-list';

export default function FeedbackForm({ lesson, onSuccess, onClose }: any) {
  const formId = React.useId();
  const [isPending, setIsPending] = React.useState(false);

  const onSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const formData = new FormData(event.target as HTMLFormElement);

      setIsPending(true);
      let response = lesson.feedback
        ? await fetch(
          `/api/lessons/${lesson.id}/feedback/${lesson.feedback.id}`,
          {
            method: 'PUT',
            body: formData,
          },
        )
        : await fetch(`/api/lessons/${lesson.id}/feedback`, {
          method: 'POST',
          body: formData,
        });

      const result = await response.json();
      setIsPending(false);
      onSuccess();
      // console.log("gdgd", result);
    },
    [lesson, onSuccess],
  );

  return (
    <Modal isOpen onClose={onClose}>
      <ModalContent>
        <ModalHeader>피드백</ModalHeader>
        <ModalBody>
          <form id={formId} onSubmit={onSubmit}>
            <FieldGroup>
              <DescriptionList>
                <DescriptionTerm>수강생</DescriptionTerm>
                {/* <DescriptionDetails>{lesson.student.name}</DescriptionDetails> */}

                <DescriptionTerm>레슨 일시</DescriptionTerm>
                <DescriptionDetails>
                  {format(new Date(lesson.lessonAt), 'yyyy-MM-dd HH:mm')}
                </DescriptionDetails>

                <DescriptionTerm>레슨 내용</DescriptionTerm>
                <DescriptionDetails>{lesson.notes}</DescriptionDetails>
              </DescriptionList>

              <Textarea name="notes" label="코멘트" defaultValue={lesson?.feedback?.notes} />
            </FieldGroup>
          </form>
        </ModalBody>
        <ModalFooter>
          {/* @ts-ignore */}
          <Button variant="light" onPress={onClose} disabled={isPending}>
            닫기
          </Button>
          <Button
            type="submit"
            form={formId}
            color="primary"
            isLoading={isPending}
          >
            저장
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
