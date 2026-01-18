'use client';

import type { ModalProps } from '@heroui/react';

import * as React from 'react';
import { Button, Chip, Form, Modal, TextArea, TextField, Label } from '@heroui/react';
import { Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { Controller, useForm } from 'react-hook-form';

import StatusBadge from '@/components/status-badge';
import { updateStudentStatus } from '@/actions/student-status';

type StudentStatusType = {
  id: number;
  status: 'active' | 'pending' | 'paused' | 'leave';
  changedAt: Date;
  notes: string | null;
};

interface Props {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  statuses: StudentStatusType[];
}

export default function StatusModal({ isOpen, onOpenChange, statuses }: Props) {
  const [editingStatus, setEditingStatus] = React.useState<StudentStatusType | null>(null);

  return (
    <>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <Modal.Container>
          <Modal.Dialog className="min-w-[320px]">
            {({ close }) => (
              <React.Fragment>
                <Modal.Header>
                  <Modal.Heading>상태 변경 내역</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="max-h-[60vh] overflow-y-auto">
                  {statuses.length === 0
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
                                  <StatusBadge status={status.status} />
                                  <Chip variant="secondary" color="default">{format(new Date(status.changedAt), 'yyyy-MM-dd', { locale: ko })}</Chip>
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
              </React.Fragment>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <EditStatusModal
        isOpen={editingStatus !== null}
        onClose={() => setEditingStatus(null)}
        studentStatus={editingStatus}
      />
    </>
  );
}

function EditStatusModal({
  isOpen,
  onClose,
  studentStatus,
}: {
  isOpen: boolean;
  onClose: () => void;
  studentStatus: StudentStatusType | null;
}) {
  const formId = React.useId();

  const { control } = useForm({
    values: {
      notes: studentStatus?.notes ?? '',
    },
  });
  const [state, formAction, isPending] = React.useActionState(updateStudentStatus, {});

  React.useEffect(() => {
    if (!state.timestamp) {
      return;
    }

    if (state.success) {
      onClose();
    }
  }, [state.success, state.timestamp, onClose]);

  if (!studentStatus) return null;

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container>
        <Modal.Dialog className="min-w-[320px]">
          {({ close }) => (
            <React.Fragment>
              <Modal.Header>
                <Modal.Heading>상태 변경 내용 수정</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <Form id={formId} className="p-1" action={formAction}>
                  <input
                    type="hidden"
                    name="studentStatusId"
                    value={studentStatus.id}
                  />
                  <div className="mb-4">
                    <StatusBadge status={studentStatus.status} />
                    <span className="ml-2 text-sm text-zinc-500">
                      {format(new Date(studentStatus.changedAt), 'yyyy-MM-dd HH:mm', { locale: ko })}
                    </span>
                  </div>
                  <Controller
                    control={control}
                    name="notes"
                    render={({ field: { name, value, onChange } }) => (
                      <TextField name={name} value={value} onChange={onChange}>
                        <Label>메모</Label>
                        <TextArea rows={5} />
                      </TextField>
                    )}
                  />
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
            </React.Fragment>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
