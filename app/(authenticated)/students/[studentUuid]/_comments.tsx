'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Button,
  Card,
  CardBody,
  CardHeader, Form, Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader, Textarea,
} from '@heroui/react';
import { PlusIcon } from 'lucide-react';
import { createStudentComment } from '../../../../actions/create-student-comment';
import { updateStudentComment } from '../../../../actions/update-student-comment';
import { format } from 'date-fns/format';

export default function Comments({ comments }) {
  const { studentUuid } = useParams();

  const [editForm, setEditForm] = React.useState(null);

  return (
    <React.Fragment>
      <Card>
        <CardHeader className="justify-between">
          <h3 className="text-lg font-bold">코멘트</h3>
          <Button
            variant="light"
            startContent={<PlusIcon width={12} height={12} />}
            color="primary"
            size="sm"
            onPress={() => {
              setEditForm('');
            }}
          >
            추가
          </Button>
        </CardHeader>
        <CardBody>
          {comments.length > 0
            ? (
                <ul className="flex flex-col gap-5">
                  {comments.map((comment: any) => (
                    <li key={`comment-${comment.id}`}>
                      <div className="flex justify-between items-end">
                        <p className="text-xs text-gray-500 font-bold">{format(comment.createdAt, 'yyyy-MM-dd hh:mm:ss')}</p>
                        <Button size="sm" variant="light" onPress={() => setEditForm(comment)}>수정</Button>
                      </div>
                      <div>
                        <p className="whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )
            : (
                <p>등록된 코멘트가 없습니다</p>
              )}
        </CardBody>
      </Card>
      <CommentFormModal
        isOpen={editForm !== null}
        onClose={() => { setEditForm(null); }}
        studentUuid={studentUuid as string}
        comment={editForm}
      />
    </React.Fragment>
  );
}

function CommentFormModal({ isOpen, onClose, studentUuid, comment }) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <Content studentUuid={studentUuid} comment={comment} />
    </Modal>
  );
}

function Content({ studentUuid, comment }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [page, setPage] = React.useState(1);

  return (
    <ModalContent>
      {onClose => (
        <React.Fragment>
          <ModalHeader>수강생 코멘트</ModalHeader>
          <ModalBody>
            <Form
              id="student-comment-form"
              onSubmit={(event) => {
                event.preventDefault();

                const formData = new FormData(event.currentTarget);
                startTransition(async () => {
                  const result = await (comment?.id ? updateStudentComment(formData) : createStudentComment(formData));
                  router.refresh();
                  onClose();
                });
              }}
            >
              <input type="hidden" name="studentUuid" value={studentUuid} />
              {comment && (
                <input type="hidden" name="id" value={comment.id} />
              )}
              <Textarea name="content" label="내용" defaultValue={comment?.content} />
            </Form>
          </ModalBody>
          <ModalFooter>
            <Button isDisabled={isPending} variant="light" onPress={onClose}>닫기</Button>
            <Button isLoading={isPending} color="primary" type="submit" form="student-comment-form">저장</Button>
          </ModalFooter>
        </React.Fragment>
      )}
    </ModalContent>
  );
}
