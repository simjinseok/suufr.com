'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import {
  Button,
  Modal,
} from '@heroui/react';
import { PlusIcon } from 'lucide-react';

import { modal } from '@/contexts/modal-manager';
import CreateStudentCommentModal from '@/components/student/create-student-comment-modal';
import EditStudentCommentModal from '@/components/student/edit-student-comment-modal';

type Comment = {
  id: number;
  uuid: string;
  content: string;
  createdAt: string;
};

type Props = {
  comments: Comment[];
  studentUuid: string;
};

export default function Comments({ comments, studentUuid }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Modal>
          <Button variant="secondary">
            <PlusIcon className="w-4 h-4" />
            코멘트 추가
          </Button>
          <CreateStudentCommentModal studentUuid={studentUuid} />
        </Modal>
      </div>

      {comments.length > 0
        ? (
            <div className="bg-white rounded-2xl overflow-hidden">
              {comments.map((comment, index) => (
                <div
                  key={comment.id}
                  className={`p-4 group ${index !== comments.length - 1 ? 'border-b border-zinc-100' : ''}`}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-400">
                        {format(new Date(comment.createdAt), 'M월 d일', { locale: ko })}
                      </p>
                      <p className="mt-1 text-sm text-zinc-900 whitespace-pre-wrap leading-relaxed">
                        {comment.content}
                      </p>
                    </div>
                    <div className="shrink-0 flex gap-1">
                      <Button
                        size="sm"
                        variant="tertiary"
                        onPress={() => modal.show(EditStudentCommentModal, { comment })}
                      >
                        수정
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          )
        : (
            <div className="py-12 text-center text-zinc-500">
              코멘트가 없습니다
            </div>
          )}
    </div>
  );
}
