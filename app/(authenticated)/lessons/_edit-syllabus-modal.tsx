'use client';
import React from 'react';
import { Form, Input, Modal, TextArea, Button, TextField, Label, AlertDialog, DangerIcon } from '@heroui/react';

import { updateSyllabus, removeSyllabus } from '@/actions/lesson';

export default function EditSyllabusModal({ syllabus, isOpen, onClose }) {
  const formId = React.useId();

  const [state, formAction, isPending] = React.useActionState(updateSyllabus, {});

  React.useEffect(() => {
    if (state.success) {
      alert('수업을 수정하였습니다.');
      onClose();
    }
  }, [state]);

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <React.Fragment>
              <Modal.Header>
                <Modal.Heading>계획 수정</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <Form
                  id={formId}
                  className="p-1"
                  action={formAction}
                >
                  <input type="hidden" name="syllabusId" value={syllabus.id} />
                  <TextField name="title" defaultValue={syllabus?.title}>
                    <Label>제목</Label>
                    <Input />
                  </TextField>
                  <TextField
                    className="mt-4"
                    name="notes"
                    defaultValue={syllabus?.notes}
                  >
                    <Label>메모</Label>
                    <TextArea />
                  </TextField>
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <DeleteButton id={syllabus.id} />
                <div className="grow" />
                <Button variant="ghost" isDisabled={isPending} onPress={onClose}>
                  닫기
                </Button>
                <Button
                  form={formId}
                  variant="primary"
                  type="submit"
                  isPending={isPending}
                >
                  저장
                </Button>
              </Modal.Footer>
            </React.Fragment>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function DeleteButton({ id }) {
  const formId = React.useId();
  const [state, formAction, isPending] = React.useActionState(removeSyllabus, {});
  // TODO: 삭제 후 어떻게 처리할지?
  return (
    <AlertDialog>
      <Button
        variant="danger-soft"
      >
        삭제
      </Button>
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="w-60">
            <AlertDialog.Header>

              <AlertDialog.Icon>
                <DangerIcon />
              </AlertDialog.Icon>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <Form
                id={formId}
                action={formAction}
              >
                <input type="hidden" name="syllabusId" value={id} />
                계획을 삭제합니다.
              </Form>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="secondary" slot="close" isDisabled={isPending}>닫기</Button>
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
