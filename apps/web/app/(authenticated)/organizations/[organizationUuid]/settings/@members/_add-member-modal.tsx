'use client';

import * as React from 'react';
import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  Modal,
  Spinner,
  TextField,
} from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';
import type { ModalProps } from '@heroui/react';
import { addMember } from '@/actions/member';
import MemberProfileImageUpload from '@/components/member/profile-image-upload';

interface Props {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  organizationUuid: string;
  onMemberAdded?: () => void;
}

export default function AddMemberModal({ isOpen, onOpenChange, organizationUuid, onMemberAdded }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="min-w-[320px]">
          {({ close }) => (
            <Content
              organizationUuid={organizationUuid}
              close={close}
              onMemberAdded={onMemberAdded}
            />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  organizationUuid: string;
  close: () => void;
  onMemberAdded?: () => void;
}

function Content({ organizationUuid, close, onMemberAdded }: ContentProps) {
  const formId = React.useId();
  const boundAddMember = addMember.bind(null, organizationUuid);

  const { control, watch } = useForm<{
    name: string;
    profileImageKey: string | null;
  }>({
    defaultValues: {
      name: '',
      profileImageKey: null,
    },
  });

  const watchName = watch('name');

  const [state, formAction, isPending] = React.useActionState(boundAddMember, {
    fields: { name: '', profileImageKey: null },
  });

  React.useEffect(() => {
    if (!state.timestamp) {
      return;
    }

    if (state.success) {
      onMemberAdded?.();
      close();
    }
  }, [state?.timestamp, state?.success, close, onMemberAdded]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>멤버 추가</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          className="p-1"
          id={formId}
          action={formAction}
          validationErrors={state?.fieldErrors}
        >
          <Controller
            control={control}
            name="profileImageKey"
            render={({ field: { value, onChange } }) => (
              <MemberProfileImageUpload
                name={watchName}
                value={value}
                onChange={onChange}
                disabled={isPending}
              />
            )}
          />

          <Controller
            control={control}
            name="name"
            render={({ field: { name, value, onChange } }) => (
              <TextField
                name={name}
                value={value}
                onChange={onChange}
                isRequired
                isReadOnly={isPending}
                className="mt-4"
              >
                <Label>멤버 이름</Label>
                <Input variant="secondary" autoComplete="off" placeholder="이름을 입력하세요" />
                <FieldError />
              </TextField>
            )}
          />

          {state.message && !state.success && (
            <p className="mt-3 text-sm text-red-600">{state.message}</p>
          )}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" isDisabled={isPending} onPress={close}>
          취소
        </Button>
        <Button
          form={formId}
          variant="primary"
          type="submit"
          isPending={isPending}
        >
          {({ isPending }) => (
            <>
              {isPending ? <Spinner color="current" size="sm" /> : null}
              추가
            </>
          )}
        </Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
