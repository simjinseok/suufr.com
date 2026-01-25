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

import { createCurriculumItem } from '@/actions/curriculum';
import MediaFilePicker, { type MediaFilePickerState } from '@/components/media/media-file-picker';

interface Props {
  curriculumUuid: string;
}

export default function CreateItemModal({ curriculumUuid }: Props) {
  return (
    <Modal.Backdrop>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content curriculumUuid={curriculumUuid} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  curriculumUuid: string;
  close: () => void;
}

function Content({ curriculumUuid, close }: ContentProps) {
  const formId = React.useId();

  const [mediaState, setMediaState] = React.useState<MediaFilePickerState>({
    existingFiles: [],
    pendingUpload: [],
    pendingDetach: [],
    pendingAddExisting: [],
  });

  const [state, formAction, isPending] = React.useActionState(createCurriculumItem, {
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

  const handleSubmit = (formData: FormData) => {
    // Add media file data to form
    if (mediaState.pendingUpload.length > 0) {
      formData.set('newMediaFiles', JSON.stringify(mediaState.pendingUpload));
    }
    if (mediaState.pendingAddExisting.length > 0) {
      formData.set('existingMediaFileUuids', JSON.stringify(mediaState.pendingAddExisting.map(f => f.uuid)));
    }

    formAction(formData);
  };

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>항목 추가</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          id={formId}
          className="p-1 flex flex-col gap-4"
          action={handleSubmit}
          validationErrors={state.fieldErrors}
        >
          <input type="hidden" name="curriculumUuid" value={curriculumUuid} />
          <Controller
            control={control}
            name="title"
            render={({ field: { name, value, onChange } }) => (
              <TextField name={name} value={value} onChange={onChange} isRequired>
                <Label>제목</Label>
                <Input variant="secondary" placeholder="예: 1단원 - 정수와 유리수" />
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
                <TextArea variant="secondary" rows={3} className="resize-none" placeholder="항목에 대한 설명" />
                <FieldError />
              </TextField>
            )}
          />

          <MediaFilePicker
            value={mediaState}
            onChange={setMediaState}
            maxFiles={5}
            variant="simple"
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
