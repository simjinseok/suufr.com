'use client';
import * as React from 'react';
import {
  Button,
  Form,
  Label,
  Modal,
  TextArea,
  TextField,
} from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';
import { updateFeedback } from '@/actions/session';

type Lesson = {
  id: number;
  feedback: {
    id: number;
    notes: string | null;
  } | null;
};

interface Props {
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  lesson: Lesson;
}

export default function UpdateFeedbackModal({ isOpen, onOpenChange, lesson }: Props) {
  const formId = React.useId();
  const { control } = useForm({
    values: {
      notes: lesson.feedback?.notes || '',
    },
  });

  const [state, formAction, isPending] = React.useActionState(updateFeedback, {
    success: false,
    timestamp: 0,
  });

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.message) {
      alert(state.message);
    }

    if (state.success) {
      onOpenChange?.(false);
    }
  }, [state.success, state.message, state.timestamp, onOpenChange]);

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <React.Fragment>
              <Modal.Header>
                <Modal.Heading>피드백 {lesson.feedback ? '수정' : '작성'}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <Form id={formId} className="p-1 flex flex-col gap-4" action={formAction}>
                  <input type="hidden" name="lessonId" value={lesson.id} />
                  <Controller
                    control={control}
                    name="notes"
                    render={({ field: { name, value, onChange } }) => (
                      <TextField
                        name={name}
                        value={value}
                        onChange={onChange}
                      >
                        <Label>피드백 내용</Label>
                        <TextArea rows={5} className="resize-none" placeholder="수업 피드백을 입력하세요" />
                      </TextField>
                    )}
                  />
                </Form>
              </Modal.Body>
              <Modal.Footer>
                {lesson.feedback && (
                  <DeleteButton lessonId={lesson.id} onSuccess={close} />
                )}
                <div className="grow" />
                <Button variant="ghost" isDisabled={isPending} onClick={close}>닫기</Button>
                <Button type="submit" form={formId} variant="primary" isPending={isPending}>저장</Button>
              </Modal.Footer>
            </React.Fragment>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function DeleteButton({ lessonId, onSuccess }: { lessonId: number; onSuccess: () => void }) {
  const [state, formAction, isPending] = React.useActionState(updateFeedback, {
    success: false,
    timestamp: 0,
  });

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      alert(state.message);
      if (typeof onSuccess === 'function') onSuccess();
    }
  }, [state.success, state.timestamp, state.message, onSuccess]);

  return (
    <Modal>
      <Button variant="danger-soft">삭제</Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            {({ close }) => (
              <React.Fragment>
                <Modal.Header>
                  <Modal.Heading>피드백 삭제</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  피드백을 삭제하시겠습니까?
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="ghost" isDisabled={isPending} onClick={close}>취소</Button>
                  <Form action={formAction}>
                    <input type="hidden" name="lessonId" value={lessonId} />
                    <input type="hidden" name="delete" value="true" />
                    <Button type="submit" variant="danger" isPending={isPending}>삭제</Button>
                  </Form>
                </Modal.Footer>
              </React.Fragment>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
