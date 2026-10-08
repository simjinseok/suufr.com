'use client';
import React from 'react';
import { Form, Input, Modal, TextArea, Button, TextField, Label, FieldError, type ModalProps } from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';
import { updateCurriculumSection } from '@/actions/curriculum';
import type { TCurriculumSection } from '@/types/index';

interface Props {
  isOpen?: ModalProps['isOpen'];
  onOpenChange?: ModalProps['onOpenChange'];
  section: Pick<TCurriculumSection, 'uuid' | 'title' | 'description'>;
  curriculumUuid: string;
}

/** 섹션 제목·설명 수정. 삭제는 ⋯ 메뉴에서. modal.show 로 띄우는 제어형. */
export default function EditSectionModal({ isOpen, onOpenChange, section, curriculumUuid }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => <Content section={section} curriculumUuid={curriculumUuid} close={close} />}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function Content({ section, curriculumUuid, close }: Omit<Props, 'isOpen' | 'onOpenChange'> & { close: () => void }) {
  const formId = React.useId();
  const [state, formAction, isPending] = React.useActionState(updateCurriculumSection, {
    fields: { title: section.title, description: section.description || '' },
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
        <Modal.Heading>섹션 수정</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form id={formId} className="p-1 flex flex-col gap-4" action={formAction} validationErrors={state.fieldErrors}>
          <input type="hidden" name="sectionUuid" value={section.uuid} />
          <input type="hidden" name="curriculumUuid" value={curriculumUuid} />
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
                <TextArea variant="secondary" rows={2} className="resize-none" />
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
