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
} from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';

import { createCurriculum } from '@/actions/curriculum';

export default function CreateCurriculumModal() {
  return (
    <Modal.Backdrop>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  close: () => void;
}

function Content({ close }: ContentProps) {
  const formId = React.useId();

  const [state, formAction, isPending] = React.useActionState(createCurriculum, {
    fields: {
      title: '',
      description: '',
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
        <Modal.Heading>커리큘럼 추가</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          id={formId}
          className="p-1 flex flex-col gap-4"
          action={formAction}
          validationErrors={state.fieldErrors}
        >
          <Controller
            control={control}
            name="title"
            render={({ field: { name, value, onChange } }) => (
              <TextField name={name} value={value} onChange={onChange} isRequired>
                <Label>제목</Label>
                <Input variant="secondary" placeholder="예: 중등 수학 기초 과정" />
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
                <TextArea variant="secondary" rows={3} className="resize-none" placeholder="커리큘럼에 대한 간단한 설명" />
                <FieldError />
              </TextField>
            )}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer>
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
