'use client';

import type { ModalProps } from '@heroui/react';

import * as React from 'react';
import { Button, Chip, Form, Modal, TextArea, TextField, Label } from '@heroui/react';
import { Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { Controller, useForm } from 'react-hook-form';

import MemberStatusBadge from '@/components/member-status-badge';
import { getMemberStatusHistory, updateMemberStatus } from '@/actions/member-status';
import type { TMemberStatus, MemberStatusValue } from '@/types/index';

interface Props {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  organizationUuid: string;
  member: {
    uuid: string;
    name: string;
  };
}

export default function StatusHistoryModal({
  isOpen,
  onOpenChange,
  organizationUuid,
  member,
}: Props) {
  const [statuses, setStatuses] = React.useState<TMemberStatus[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [editingStatus, setEditingStatus] = React.useState<TMemberStatus | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      getMemberStatusHistory(organizationUuid, member.uuid)
        .then(setStatuses)
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, organizationUuid, member.uuid]);

  const handleStatusUpdated = (updatedStatus: TMemberStatus) => {
    setStatuses(prev =>
      prev.map(s => (s.uuid === updatedStatus.uuid ? updatedStatus : s)),
    );
    setEditingStatus(null);
  };

  return (
    <>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <Modal.Container>
          <Modal.Dialog className="min-w-[320px]">
            {({ close }) => (
              <>
                <Modal.Header>
                  <Modal.Heading>{member.name}님의 상태 변경 내역</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="max-h-[60vh] overflow-y-auto">
                  {isLoading
                    ? (
                        <div className="py-8 text-center text-zinc-500">
                          로딩 중...
                        </div>
                      )
                    : statuses.length === 0
                      ? (
                          <div className="py-8 text-center text-zinc-500">
                            상태 변경 내역이 없습니다
                          </div>
                        )
                      : (
                          <div className="space-y-2">
                            {statuses.map(status => (
                              <div
                                key={status.id}
                                className="flex gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/30"
                              >
                                <div className="grow min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <MemberStatusBadge status={status.status as MemberStatusValue} />
                                    <Chip variant="secondary" color="default">
                                      {format(new Date(status.changedAt), 'yyyy-MM-dd', { locale: ko })}
                                    </Chip>
                                  </div>
                                  {status.notes && (
                                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                                      {status.notes}
                                    </p>
                                  )}
                                </div>
                                <div className="flex-shrink-0">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    isIconOnly
                                    onPress={() => setEditingStatus(status)}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="ghost" onPress={close}>
                    닫기
                  </Button>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <EditStatusModal
        isOpen={editingStatus !== null}
        onClose={() => setEditingStatus(null)}
        organizationUuid={organizationUuid}
        memberStatus={editingStatus}
        onUpdated={handleStatusUpdated}
      />
    </>
  );
}

function EditStatusModal({
  isOpen,
  onClose,
  organizationUuid,
  memberStatus,
  onUpdated,
}: {
  isOpen: boolean;
  onClose: () => void;
  organizationUuid: string;
  memberStatus: TMemberStatus | null;
  onUpdated: (status: TMemberStatus) => void;
}) {
  const formId = React.useId();

  const { control } = useForm({
    values: {
      notes: memberStatus?.notes ?? '',
    },
  });

  const boundUpdateMemberStatus = memberStatus
    ? updateMemberStatus.bind(null, organizationUuid, memberStatus.uuid)
    : async () => ({ success: false, message: '상태를 찾을 수 없습니다', timestamp: Date.now() });

  const [state, formAction, isPending] = React.useActionState(boundUpdateMemberStatus, {});

  React.useEffect(() => {
    if (!state.timestamp) {
      return;
    }

    if (state.success && memberStatus) {
      const formElement = document.getElementById(formId) as HTMLFormElement;
      const notesValue = formElement?.querySelector<HTMLTextAreaElement>('[name="notes"]')?.value;
      onUpdated({
        ...memberStatus,
        notes: notesValue || null,
      });
    }
  }, [state.success, state.timestamp, onClose, memberStatus, formId, onUpdated]);

  if (!memberStatus) return null;

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container>
        <Modal.Dialog className="min-w-[320px]">
          {({ close }) => (
            <>
              <Modal.Header>
                <Modal.Heading>상태 변경 사유 수정</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <Form id={formId} className="p-1" action={formAction}>
                  <div className="mb-4">
                    <MemberStatusBadge status={memberStatus.status as MemberStatusValue} />
                    <span className="ml-2 text-sm text-zinc-500">
                      {format(new Date(memberStatus.changedAt), 'yyyy-MM-dd HH:mm', { locale: ko })}
                    </span>
                  </div>
                  <Controller
                    control={control}
                    name="notes"
                    render={({ field: { name, value, onChange } }) => (
                      <TextField name={name} value={value} onChange={onChange}>
                        <Label>사유</Label>
                        <TextArea rows={5} autoFocus />
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
