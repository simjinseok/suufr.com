'use client';
import React from 'react';
import {
  Form,
  Input,
  Modal,
  TextArea,
  Button,
  TextField,
  Label,
  FieldError,
  Popover,
} from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';

import { updateCurriculum, removeCurriculum } from '@/actions/curriculum';
import type { TCurriculum } from '@/types/index';

interface Props {
  curriculum: TCurriculum;
}

export default function EditCurriculumModal({ curriculum }: Props) {
  return (
    <Modal.Backdrop>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content curriculum={curriculum} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  curriculum: TCurriculum;
  close: () => void;
}

function Content({ curriculum, close }: ContentProps) {
  const formId = React.useId();

  const [state, formAction, isPending] = React.useActionState(updateCurriculum, {
    fields: {
      title: curriculum.title,
      description: curriculum.description || '',
    },
  });

  const { control } = useForm({
    values: {
      title: state.fields?.title || '',
      description: state.fields?.description || '',
    },
  });

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      alert(state.message);
      close();
    }
  }, [state.timestamp, state.success]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>커리큘럼 수정</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          id={formId}
          className="p-1 flex flex-col gap-4"
          action={formAction}
          validationErrors={state.fieldErrors}
        >
          <input type="hidden" name="curriculumUuid" value={curriculum.uuid} />
          <Controller
            control={control}
            name="title"
            render={({ field: { name, value, onChange } }) => (
              <TextField name={name} value={value} onChange={onChange} isRequired>
                <Label>제목</Label>
                <Input variant="secondary" />
                <FieldError />
              </TextField>
            )}
          />
          <Controller
            control={control}
            name="description"
            render={({ field: { name, value, onChange } }) => (
              <TextField name={name} value={value} onChange={onChange}>
                <Label>설명</Label>
                <TextArea variant="secondary" rows={3} className="resize-none" />
                <FieldError />
              </TextField>
            )}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <RemoveButton curriculumUuid={curriculum.uuid} onSuccess={close} />
        <div className="grow" />
        <Button variant="ghost" isDisabled={isPending} onClick={close}>
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
  );
}

interface RemoveButtonProps {
  curriculumUuid: string;
  onSuccess: () => void;
}

function RemoveButton({ curriculumUuid, onSuccess }: RemoveButtonProps) {
  const [state, formAction, isPending] = React.useActionState(removeCurriculum, {});

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      alert(state.message);
      if (typeof onSuccess === 'function') onSuccess();
    }
  }, [state.success, state.timestamp, state.message, onSuccess]);

  return (
    <Popover>
      <Button variant="danger-soft">삭제</Button>
      <Popover.Content placement="top left">
        <Popover.Arrow />
        <Popover.Dialog>
          <Popover.Heading>삭제 확인</Popover.Heading>
          <p className="mt-1 mb-3">커리큘럼과 모든 항목을 삭제합니다.</p>
          <Form action={formAction}>
            <input type="hidden" name="curriculumUuid" value={curriculumUuid} />
            <Button type="submit" variant="danger" isPending={isPending}>삭제</Button>
          </Form>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
