'use client';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button, Form, Label, Modal, Spinner, TextArea, TextField } from '@heroui/react';
import { createStudentComment } from '@/actions/student-comment';

export default function CreateStudentCommentModal({
  isOpen,
  onClose,
  studentUuid,
}: {
  isOpen: boolean;
  onClose: () => void;
  studentUuid: string;
}) {

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container>
        <Modal.Dialog className="min-w-[320px]">
          {({ close }) => (
            <Content studentUuid={studentUuid} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function Content({ studentUuid, close }) {
  const formId = React.useId();

  const { control } = useForm({
    values: {
      content: '',
    },
  });
  const [state, formAction, isPending] = React.useActionState(createStudentComment, {});

  React.useEffect(() => {
    if (!state.timestamp) {
      return;
    }

    if (state.success) {
      alert('수정하였습니다');
      close();
    }
  }, [state.success, state.timestamp]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>'코멘트 추가'</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form id={formId} action={formAction} className="p-1" validationErrors={state.fieldErrors}>
          <input type="hidden" name="studentUuid" value={studentUuid} />
          <Controller
            control={control}
            name="content"
            render={({ field: { name, value, onChange } }) => (
              <TextField name={name} value={value} onChange={onChange}>
                <Label>내용</Label>
                <TextArea rows={5} autoFocus />
              </TextField>
            )}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" isDisabled={isPending} onPress={close}>
          닫기
        </Button>
        <Button
          form={formId}
          variant="primary"
          type="submit"
          isPending={isPending}
        >
          {({ isPending: pending }) => (
            <>
              {pending ? <Spinner color="current" size="sm" /> : null}
              저장
            </>
          )}
        </Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
