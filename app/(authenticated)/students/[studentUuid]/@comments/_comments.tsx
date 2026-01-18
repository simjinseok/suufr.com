'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  Button,
  Modal,
  Spinner,
} from '@heroui/react';
import { MessageCircle, PlusIcon, Pencil, Trash2 } from 'lucide-react';

import { deleteStudentComment } from '@/actions/student-comment';
import CreateStudentCommentModal from '@/components/student/create-student-comment-modal';
import EditStudentCommentModal from '@/components/student/edit-student-comment-modal';

type Comment = {
  id: number;
  content: string;
  createdAt: Date;
};

type Props = {
  comments: Comment[];
  studentUuid: string;
};

export default function Comments({ comments, studentUuid }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex justify-end mb-4">
        <Modal>
          <Button
            variant="secondary"
          >
            <PlusIcon className="w-4 h-4" />
            코멘트 추가
          </Button>
          <CreateStudentCommentModal studentUuid={studentUuid} />
        </Modal>
      </div>

      {comments.length === 0
        ? (
            <div className="py-12 text-center text-zinc-500">
              코멘트가 없습니다
            </div>
          )
        : (
            <div className="space-y-2">
              {comments.map(comment => (
                <div
                  key={comment.id}
                  className="flex gap-3 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group"
                >
                  <div className="shrink-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <MessageCircle className="w-4 h-4 text-blue-600" />
                    </div>
                  </div>

                  <div className="grow min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-zinc-400">
                        {format(new Date(comment.createdAt), 'yyyy-MM-dd HH:mm')}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  </div>

                  <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex gap-1">
                      <Modal>
                        <Button
                          size="sm"
                          variant="ghost"
                          isIconOnly
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>

                        <EditStudentCommentModal
                          comment={comment}
                        />
                      </Modal>
                      <DeleteCommentButton commentId={comment.id} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
