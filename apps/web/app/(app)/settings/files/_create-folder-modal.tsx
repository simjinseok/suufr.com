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
  Description,
  toast,
} from '@heroui/react';
import { FolderPlus } from 'lucide-react';

import { createFolderAction, type CreateFolderState } from '@/actions/storage';

interface CreateFolderModalProps {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  parentFolderUuid?: string;
}

export default function CreateFolderModal({ isOpen, onOpenChange, parentFolderUuid }: CreateFolderModalProps) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container className="max-w-sm">
        <Modal.Dialog>
          {({ close }) => (
            <Content parentFolderUuid={parentFolderUuid} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  parentFolderUuid?: string;
  close: () => void;
}

function Content({ parentFolderUuid, close }: ContentProps) {
  const formId = React.useId();

  const [state, formAction, isPending] = React.useActionState(createFolderAction, {
    fields: { name: '', parentUuid: parentFolderUuid },
  } as CreateFolderState);

  const { control } = useForm({
    values: {
      name: state.fields?.name ?? '',
    },
  });

  React.useEffect(() => {
    if (state.success) {
      toast.success('폴더가 생성되었습니다.');
      close();
    }
  }, [state.success, close]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading className="flex items-center gap-2">
          <FolderPlus className="w-5 h-5" />
          새 폴더
        </Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          id={formId}
          action={formAction}
          validationErrors={state.errors}
        >
          {parentFolderUuid && (
            <input type="hidden" name="parentUuid" value={parentFolderUuid} />
          )}
          <Controller
            control={control}
            name="name"
            render={({ field: { name, value, onChange } }) => (
              <TextField
                name={name}
                value={value}
                onChange={onChange}
                isReadOnly={isPending}
                autoFocus
              >
                <Label>폴더 이름</Label>
                <Input variant="secondary" placeholder="폴더 이름을 입력하세요" maxLength={50} />
                <FieldError />
                <Description>
                  한글, 영문, 숫자, 공백, -, _ 만 사용 가능합니다.
                </Description>
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
          만들기
        </Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
