'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Button,
  Modal,
  ModalProps,
  TextField,
  Input,
  Form,
  Label,
  FieldError,
  toast,
} from '@heroui/react';
import { Pencil } from 'lucide-react';

import { renameFileAction, type RenameFileState } from '@/actions/storage';
import type { TMediaFile } from '@/types/index';

interface RenameFileModalProps {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  file: TMediaFile | null;
}

export default function RenameFileModal({ isOpen, onOpenChange, file }: RenameFileModalProps) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container className="max-w-sm">
        <Modal.Dialog>
          {({ close }) => file && <Content file={file} close={close} />}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  file: TMediaFile;
  close: () => void;
}

function Content({ file, close }: ContentProps) {
  const formId = React.useId();
  const fileName = file.fileName || 'Untitled';

  // 확장자 분리
  const lastDotIndex = fileName.lastIndexOf('.');
  const hasExtension = lastDotIndex > 0;
  const baseName = hasExtension ? fileName.slice(0, lastDotIndex) : fileName;
  const extension = hasExtension ? fileName.slice(lastDotIndex) : '';

  const [state, formAction, isPending] = React.useActionState(renameFileAction, {
    fields: { uuid: file.uuid, fileName: fileName },
  } as RenameFileState);

  // 현재 상태의 파일명에서 확장자 제외한 부분 추출
  const currentBaseName = React.useMemo(() => {
    const currentFileName = state.fields?.fileName ?? fileName;
    const dotIndex = currentFileName.lastIndexOf('.');
    return dotIndex > 0 ? currentFileName.slice(0, dotIndex) : currentFileName;
  }, [state.fields?.fileName, fileName]);

  const { control } = useForm({
    values: {
      baseName: currentBaseName,
    },
  });

  React.useEffect(() => {
    if (state.success) {
      toast.success('파일 이름이 변경되었습니다.', {
        timeout: 3000,
      });
      close();
    }
  }, [state.success, close]);

  // 폼 제출 시 확장자 붙여서 전송
  const handleFormAction = (formData: FormData) => {
    const baseNameValue = formData.get('baseName') as string;
    formData.delete('baseName');
    formData.set('fileName', baseNameValue + extension);
    return formAction(formData);
  };

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading className="flex items-center gap-2">
          <Pencil className="w-5 h-5" />
          파일 이름 변경
        </Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          id={formId}
          action={handleFormAction}
          validationErrors={state.errors ? {
            baseName: state.errors.fileName,
          } : undefined}
        >
          <input type="hidden" name="uuid" value={file.uuid} />
          <Controller
            control={control}
            name="baseName"
            render={({ field: { name, value, onChange } }) => (
              <TextField
                name={name}
                value={value}
                onChange={onChange}
                isReadOnly={isPending}
                autoFocus
              >
                <Label>파일 이름</Label>
                <div className="flex items-center gap-1">
                  <Input
                    variant="secondary"
                    placeholder="파일 이름을 입력하세요"
                    maxLength={100 - extension.length}
                    className="flex-1"
                  />
                  {extension && (
                    <span className="text-gray-500 shrink-0">{extension}</span>
                  )}
                </div>
                <FieldError />
              </TextField>
            )}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onPress={close} isDisabled={isPending}>
          취소
        </Button>
        <Button
          form={formId}
          type="submit"
          variant="primary"
          isPending={isPending}
        >
          저장
        </Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
