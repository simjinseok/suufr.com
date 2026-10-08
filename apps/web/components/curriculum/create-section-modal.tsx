'use client';
import React from 'react';
import { Form, Input, Modal, TextArea, Button, TextField, Label, FieldError } from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';
import { createCurriculumSection } from '@/actions/curriculum';

interface Props {
  curriculumUuid: string;
}

export default function CreateSectionModal({ curriculumUuid }: Props) {
  return (
    <Modal.Backdrop>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => <Content curriculumUuid={curriculumUuid} close={close} />}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function Content({ curriculumUuid, close }: Props & { close: () => void }) {
  const formId = React.useId();
  const [state, formAction, isPending] = React.useActionState(createCurriculumSection, {
    fields: { title: '', description: '' },
  });
  const { control } = useForm({
    values: { title: state.fields?.title || '', description: state.fields?.description || '' },
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
        <Modal.Heading>섹션 추가</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form id={formId} className="p-1 flex flex-col gap-4" action={formAction} validationErrors={state.fieldErrors}>
          <input type="hidden" name="curriculumUuid" value={curriculumUuid} />
          <Controller
            control={control}
            name="title"
            render={({ field: { name, value, onChange } }) => (
              <TextField name={name} value={value} onChange={onChange} isRequired>
                <Label>제목</Label>
                <Input variant="secondary" placeholder="예: 1개월차" />
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
                <TextArea variant="secondary" rows={2} className="resize-none" placeholder="선택" />
                <FieldError />
              </TextField>
            )}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" isDisabled={isPending} onClick={close}>닫기</Button>
        <Button form={formId} variant="primary" type="submit" isPending={isPending}>저장</Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
