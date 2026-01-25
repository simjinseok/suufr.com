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

import { updateCurriculumItem, removeCurriculumItem } from '@/actions/curriculum';
import MediaFilePicker, { type MediaFilePickerState } from '@/components/media/media-file-picker';
import type { TCurriculumItem, TLessonMediaFile } from '@/types/index';

interface Props {
  item: TCurriculumItem;
  curriculumUuid: string;
}

export default function EditItemModal({ item, curriculumUuid }: Props) {
  return (
    <Modal.Backdrop>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content item={item} curriculumUuid={curriculumUuid} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  item: TCurriculumItem;
  curriculumUuid: string;
  close: () => void;
}

function Content({ item, curriculumUuid, close }: ContentProps) {
  const formId = React.useId();

  // Convert curriculum item media files to lesson media file format for the picker
  const existingFiles: TLessonMediaFile[] = (item.mediaFiles ?? []).map(mf => ({
    id: mf.id,
    mediaFileId: mf.mediaFileId,
    mediaFile: mf.mediaFile,
  }));

  const [mediaState, setMediaState] = React.useState<MediaFilePickerState>({
    existingFiles,
    pendingUpload: [],
    pendingDetach: [],
    pendingAddExisting: [],
  });

  const [state, formAction, isPending] = React.useActionState(updateCurriculumItem, {
    fields: {
      title: item.title,
      description: item.description || '',
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
      formData.set('addNewMediaFiles', JSON.stringify(mediaState.pendingUpload));
    }
    if (mediaState.pendingAddExisting.length > 0) {
      formData.set('addExistingMediaFileUuids', JSON.stringify(mediaState.pendingAddExisting.map(f => f.uuid)));
    }
    if (mediaState.pendingDetach.length > 0) {
      formData.set('removeMediaFileUuids', JSON.stringify(mediaState.pendingDetach));
    }

    formAction(formData);
  };

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>항목 수정</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          id={formId}
          className="p-1 flex flex-col gap-4"
          action={handleSubmit}
          validationErrors={state.fieldErrors}
        >
          <input type="hidden" name="itemUuid" value={item.uuid} />
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
                <TextArea variant="secondary" rows={3} className="resize-none" />
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
        <RemoveButton itemUuid={item.uuid} curriculumUuid={curriculumUuid} onSuccess={close} />
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
  itemUuid: string;
  curriculumUuid: string;
  onSuccess: () => void;
}

function RemoveButton({ itemUuid, curriculumUuid, onSuccess }: RemoveButtonProps) {
  const [state, formAction, isPending] = React.useActionState(removeCurriculumItem, {});

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
          <p className="mt-1 mb-3">해당 항목을 삭제합니다.</p>
          <Form action={formAction}>
            <input type="hidden" name="itemUuid" value={itemUuid} />
            <input type="hidden" name="curriculumUuid" value={curriculumUuid} />
            <Button type="submit" variant="danger" isPending={isPending}>삭제</Button>
          </Form>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
