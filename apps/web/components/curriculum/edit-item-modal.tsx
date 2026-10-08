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
  type ModalProps,
} from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';

import { updateCurriculumItem } from '@/actions/curriculum';
import MediaFilePicker, { type MediaFilePickerState } from '@/components/media/media-file-picker';
import SectionSelect from '@/components/curriculum/section-select';
import type { TCurriculumItem, TCurriculumSection, TLessonMediaFile } from '@/types/index';

interface Props {
  // modal.show 로 띄울 때 제어형. 트리거형(<Modal> 자식)으로 쓰면 둘 다 생략.
  isOpen?: ModalProps['isOpen'];
  onOpenChange?: ModalProps['onOpenChange'];
  item: TCurriculumItem;
  curriculumUuid: string;
  sections: Pick<TCurriculumSection, 'uuid' | 'title'>[];
}

export default function EditItemModal({ isOpen, onOpenChange, item, curriculumUuid, sections }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content item={item} curriculumUuid={curriculumUuid} sections={sections} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  item: TCurriculumItem;
  curriculumUuid: string;
  sections: Pick<TCurriculumSection, 'uuid' | 'title'>[];
  close: () => void;
}

function Content({ item, curriculumUuid, sections, close }: ContentProps) {
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

          {sections.length > 0 && (
            <SectionSelect sections={sections} defaultValue={item.sectionUuid ?? ''} isDisabled={isPending} />
          )}

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
