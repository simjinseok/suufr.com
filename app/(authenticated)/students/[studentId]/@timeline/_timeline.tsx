'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  Button,
  Form,
  Modal,
  TextArea,
  TextField,
  Label,
  Spinner,
} from '@heroui/react';
import { MessageCircle, ArrowRightLeft, PlusIcon, Pencil, Trash2 } from 'lucide-react';
import StatusBadge from '@/components/status-badge';
import { Controller, useForm } from 'react-hook-form';

import { createStudentComment, updateStudentComment, deleteStudentComment } from '@/actions/student-comment';
import { updateStudentStatus } from '@/actions/student-status';

type Comment = {
  id: number;
  content: string;
  createdAt: Date;
};

type StudentStatusType = {
  id: number;
  status: string;
  changedAt: Date;
  notes: string | null;
};

type TimelineItem
  = | { type: 'comment'; data: Comment; timestamp: Date }
    | { type: 'status'; data: StudentStatusType; timestamp: Date };

type Props = {
  comments: Comment[];
  statuses: StudentStatusType[];
};

export default function Timeline({ comments, statuses }: Props) {
  const { studentId } = useParams();
  const [editingComment, setEditingComment] = React.useState<Comment | null | 'new'>(null);
  const [editingStatus, setEditingStatus] = React.useState<StudentStatusType | null>(null);

  const timelineItems: TimelineItem[] = React.useMemo(() => {
    const items: TimelineItem[] = [
      ...comments.map(c => ({
        type: 'comment' as const,
        data: c,
        timestamp: new Date(c.createdAt),
      })),
      ...statuses.map(s => ({
        type: 'status' as const,
        data: s,
        timestamp: new Date(s.changedAt),
      })),
    ];

    return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [comments, statuses]);

  return (
    <div className="space-y-2">
      <div className="flex justify-end mb-4">
        <Button
          variant="secondary"
          size="sm"
          onPress={() => setEditingComment('new')}
        >
          <PlusIcon className="w-4 h-4" />
          코멘트 추가
        </Button>
      </div>

      {timelineItems.length === 0
        ? (
            <div className="py-12 text-center text-zinc-500">
              타임라인 항목이 없습니다
            </div>
          )
        : (
            <div className="space-y-2">
              {timelineItems.map(item => (
                <div
                  key={`${item.type}-${item.data.id}`}
                  className="flex gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group"
                >
                  <div className="flex-shrink-0">
                    {item.type === 'comment'
                      ? (
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <MessageCircle className="w-4 h-4 text-blue-600" />
                          </div>
                        )
                      : (
                          <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <ArrowRightLeft className="w-4 h-4 text-purple-600" />
                          </div>
                        )}
                  </div>

                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.type === 'comment'
                        ? (
                            <>
                              <span className="font-semibold text-sm text-zinc-900 dark:text-white">코멘트</span>
                              <span className="text-xs text-zinc-400">
                                {format(item.timestamp, 'yyyy-MM-dd HH:mm')}
                              </span>
                            </>
                          )
                        : (
                            <>
                              <span className="font-semibold text-sm text-zinc-900 dark:text-white">상태 변경</span>
                              <StatusBadge status={item.data.status} />
                              <span className="text-xs text-zinc-400">
                                {format(item.timestamp, 'yyyy-MM-dd HH:mm')}
                              </span>
                            </>
                          )}
                    </div>

                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                      {item.type === 'comment' ? item.data.content : item.data.notes || ''}
                    </p>
                  </div>

                  <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.type === 'comment'
                      ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              isIconOnly
                              onPress={() => setEditingComment(item.data)}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <DeleteCommentButton commentId={item.data.id} />
                          </div>
                        )
                      : (
                          <Button
                            size="sm"
                            variant="ghost"
                            isIconOnly
                            onPress={() => setEditingStatus(item.data)}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                        )}
                  </div>
                </div>
              ))}
            </div>
          )}

      <CommentModal
        isOpen={editingComment !== null}
        onClose={() => setEditingComment(null)}
        studentId={studentId as string}
        comment={editingComment === 'new' ? null : editingComment}
      />

      <StudentStatusModal
        isOpen={editingStatus !== null}
        onClose={() => setEditingStatus(null)}
        studentStatus={editingStatus}
      />
    </div>
  );
}

function DeleteCommentButton({ commentId }: { commentId: number }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const handleDelete = () => {
    if (!confirm('코멘트를 삭제하시겠습니까?')) return;

    startTransition(async () => {
      await deleteStudentComment(commentId);
      router.refresh();
    });
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      isIconOnly
      isPending={isPending}
      onPress={handleDelete}
    >
      {({ isPending: pending }) => (
        pending ? <Spinner size="sm" /> : <Trash2 className="w-3 h-3" />
      )}
    </Button>
  );
}

function CommentModal({
  isOpen,
  onClose,
  studentId,
  comment,
}: {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  comment: Comment | null;
}) {
  const router = useRouter();
  const formId = React.useId();
  const [isPending, startTransition] = React.useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      if (comment?.id) {
        await updateStudentComment(formData);
      }
      else {
        await createStudentComment(formData);
      }
      router.refresh();
      onClose();
    });
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container>
        <Modal.Dialog className="min-w-[320px]">
          {({ close }) => (
            <React.Fragment>
              <Modal.Header>
                <Modal.Heading>{comment ? '코멘트 수정' : '코멘트 추가'}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <Form id={formId} onSubmit={handleSubmit}>
                  <input type="hidden" name="studentId" value={studentId} />
                  {comment && <input type="hidden" name="id" value={comment.id} />}
                  <TextField name="content" defaultValue={comment?.content || ''}>
                    <Label>내용</Label>
                    <TextArea rows={5} autoFocus />
                  </TextField>
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
                  {({ isPending: pending }) => (
                    <>
                      {pending ? <Spinner color="current" size="sm" /> : null}
                      저장
                    </>
                  )}
                </Button>
              </Modal.Footer>
            </React.Fragment>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function StudentStatusModal({
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
      notes: studentStatus?.notes,
    },
  });
  const [state, formAction, isPending] = React.useActionState(updateStudentStatus, {});

  React.useEffect(() => {
    if (!state.timestamp) {
      return;
    }

    if (state.success) {
      alert('수정하였습니다');
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
                      {format(new Date(studentStatus.changedAt), 'yyyy-MM-dd HH:mm')}
                    </span>
                  </div>
                  <Controller
                    control={control}
                    name="notes"
                    render={({ field: { name, value, onChange } }) => (
                      <TextField name={name} value={value} onChange={onChange}>
                        <Label>메모</Label>
                        <TextArea rows={5} autoFocus />
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
