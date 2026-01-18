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
import type { OrganizationRole, MemberStatusValue } from '@/prisma/generated/client';
import { updateMember } from '@/actions/member';
import MemberProfileImageUpload from '@/components/member/profile-image-upload';

type Member = {
  id: number;
  uuid: string;
  name: string;
  role: OrganizationRole;
  status: MemberStatusValue;
  profileImageUrl?: string | null;
  userId: string | null;
  isLinked: boolean;
  isSelf: boolean;
};

interface Props {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  organizationUuid: string;
  member: Member;
  onMemberUpdated?: (updatedMember: Partial<Member>) => void;
}

export default function EditMemberModal({ isOpen, onOpenChange, organizationUuid, member, onMemberUpdated }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="min-w-[320px]">
          {({ close }) => (
            <Content
              organizationUuid={organizationUuid}
              member={member}
              close={close}
              onMemberUpdated={onMemberUpdated}
            />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  organizationUuid: string;
  member: Member;
  close: () => void;
  onMemberUpdated?: (updatedMember: Partial<Member>) => void;
}

function Content({ organizationUuid, member, close, onMemberUpdated }: ContentProps) {
  const formId = React.useId();
  const boundUpdateMember = updateMember.bind(null, organizationUuid, member.uuid);

  const { control, watch } = useForm<{
    name: string;
    profileImageKey: string | null;
  }>({
    defaultValues: {
      name: member.name,
      profileImageKey: null,
    },
  });

  const watchName = watch('name');

  const [state, formAction, isPending] = React.useActionState(boundUpdateMember, {
    fields: {
      name: member.name,
      profileImageKey: null,
      profileImageUrl: null,
    },
  });

  React.useEffect(() => {
    if (!state.timestamp) {
      return;
    }

    if (state.success) {
      onMemberUpdated?.({
        name: state.fields?.name,
        profileImageUrl: state.fields?.profileImageUrl,
      });
      close();
    }
  }, [state?.timestamp, state?.success, state?.fields, close, onMemberUpdated]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>멤버 정보 수정</Modal.Heading>
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
                currentImageUrl={member.profileImageUrl}
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
                <Input autoComplete="off" />
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
              저장
            </>
          )}
        </Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
