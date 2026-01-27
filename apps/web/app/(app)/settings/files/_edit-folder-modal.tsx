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

import { updateFolderAction, type UpdateFolderState } from '@/actions/storage';
import type { TFolder } from '@/types/index';

interface EditFolderModalProps {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  folder: TFolder | null;
}

export default function EditFolderModal({ isOpen, onOpenChange, folder }: EditFolderModalProps) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container className="max-w-sm">
        <Modal.Dialog>
          {({ close }) => folder && <Content folder={folder} close={close} />}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  folder: TFolder;
  close: () => void;
}

function Content({ folder, close }: ContentProps) {
  const formId = React.useId();

  const [state, formAction, isPending] = React.useActionState(updateFolderAction, {
    fields: { uuid: folder.uuid, name: folder.name },
  } as UpdateFolderState);

  const { control } = useForm({
    values: {
      name: state.fields?.name ?? folder.name,
    },
  });

  React.useEffect(() => {
    if (state.success) {
      toast.success('폴더 이름이 변경되었습니다.');
      close();
    }
  }, [state.success, close]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading className="flex items-center gap-2">
          <Pencil className="w-5 h-5" />
          폴더 이름 변경
        </Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          id={formId}
          action={formAction}
          validationErrors={state.errors}
        >
          <input type="hidden" name="uuid" value={folder.uuid} />
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
