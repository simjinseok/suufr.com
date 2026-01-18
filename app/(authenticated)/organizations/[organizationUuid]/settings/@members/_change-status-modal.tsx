'use client';

import type { ModalProps } from '@heroui/react';

import * as React from 'react';
import {
  Button,
  Form,
  Modal,
  Select,
  TextArea,
  TextField,
  Label,
  ListBox,
} from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';

import { createMemberStatus } from '@/actions/member-status';
import type { MemberStatusValue } from '@/types/index';

interface Props {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  organizationUuid: string;
  member: {
    uuid: string;
    name: string;
    status: MemberStatusValue;
  };
  onStatusChange?: (newStatus: MemberStatusValue) => void;
}

export default function ChangeStatusModal({
  isOpen,
  onOpenChange,
  organizationUuid,
  member,
  onStatusChange,
}: Props) {
  const formId = React.useId();

  const { control, reset } = useForm({
    values: {
      status: member.status,
      notes: '',
    },
  });

  const boundCreateMemberStatus = createMemberStatus.bind(null, organizationUuid, member.uuid);
  const [state, formAction, isPending] = React.useActionState(boundCreateMemberStatus, {});

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      const formElement = document.getElementById(formId) as HTMLFormElement;
      const selectedStatus = formElement?.querySelector<HTMLInputElement>('[name="status"]')?.value;
      if (selectedStatus && onStatusChange) {
        onStatusChange(selectedStatus as MemberStatusValue);
      }
      reset({ status: member.status, notes: '' });
      onOpenChange?.(false);
    }
  }, [state.timestamp, state.success, onOpenChange, reset, member.status, formId, onStatusChange]);

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="min-w-[320px]">
          {({ close }) => (
            <>
              <Modal.Header>
                <Modal.Heading>멤버 상태 변경</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="mb-4 text-sm text-zinc-600">
                  <strong>{member.name}</strong>님의 상태를 변경합니다.
                </p>
                <Form
                  className="p-1"
                  id={formId}
                  action={formAction}
                  validationErrors={state.fieldErrors}
                >
                  <Controller
                    control={control}
                    name="status"
                    render={({ field: { name, value, onChange } }) => (
                      <Select
                        name={name}
                        selectedKey={value}
                        onSelectionChange={key => onChange(key as string)}
                        disabledKeys={[member.status]}
                        isDisabled={isPending}
                      >
                        <Label>상태</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox aria-label="상태 목록">
                            <ListBox.Item id="active">활동중</ListBox.Item>
                            <ListBox.Item id="paused">일시정지</ListBox.Item>
                            <ListBox.Item id="leave">탈퇴</ListBox.Item>
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    )}
                  />
                  <Controller
                    control={control}
                    name="notes"
                    render={({ field: { name, value, onChange } }) => (
                      <TextField className="mt-4" name={name} value={value} onChange={onChange}>
                        <Label>사유 (선택)</Label>
                        <TextArea rows={3} placeholder="상태 변경 사유를 입력하세요" />
                      </TextField>
                    )}
                  />
                  {state.message && !state.success && (
                    <p className="mt-2 text-sm text-red-600">{state.message}</p>
                  )}
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" isDisabled={isPending} onPress={close}>
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
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
