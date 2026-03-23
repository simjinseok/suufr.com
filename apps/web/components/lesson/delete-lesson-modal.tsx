'use client';

import React from 'react';
import { AlertDialog, Button, DangerIcon, Form, ModalProps, toast } from '@heroui/react';
import { TLesson } from '@/types/index';
import { removeLesson } from '@/actions/lesson';

interface Props {
  isOpen?: ModalProps['isOpen'];
  onOpenChange?: ModalProps['onOpenChange'];
  lesson: TLesson;
}

export default function DeleteLessonModal({ lesson, isOpen, onOpenChange }: Props) {
  const formId = React.useId();
  const [state, formAction, isPending] = React.useActionState(removeLesson, {});

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.message) {
      toast.success('레슨 삭제', {
        description: state.message,
        timeout: 3000,
      });
    }

    if (state.success) {
      onOpenChange?.(false);
    }
  }, [state.success, state.timestamp, state.message]);

  return (
    <AlertDialog>
      <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <AlertDialog.Container placement="center">
          <AlertDialog.Dialog className="w-60">
            <AlertDialog.Header>
              <AlertDialog.Icon>
                <DangerIcon />
              </AlertDialog.Icon>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <Form id={formId} action={formAction}>
                <input type="hidden" name="lessonUuid" value={lesson.uuid} />
                계획을 삭제합니다.
              </Form>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="tertiary" slot="close" isDisabled={isPending}>
                닫기
              </Button>
              <Button
                type="submit"
                form={formId}
                variant="danger-soft"
                isPending={isPending}
              >
                삭제
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
