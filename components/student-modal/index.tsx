import React from 'react';
import { EllipsisVerticalIcon, LoaderIcon } from 'lucide-react';
import {
  Button,
  Form,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Input,
  Select,
  SelectItem,
  Textarea,
} from '@heroui/react';
import { createStudent } from '../../actions/create-student';
import removeStudent from '../../actions/remove-student';
import { updateStudent } from '../../actions/update-student';

export default function StudentModal({ isOpen, onClose, student }) {
  const formId = React.useId();

  const [isPending, startTransition] = React.useTransition();

  const onSubmit = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    startTransition(async () => {
      const result = student ? await updateStudent(formData) : await createStudent(formData);
      if (result.success) {
        onClose();
      }
    });
  }, [student]);

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <ModalContent>
        {onClose => (
          <React.Fragment>
            <ModalHeader>{student ? '수강생 정보 수정' : '수강생 추가'}</ModalHeader>
            <ModalBody>
              <Form
                id={formId}
                onSubmit={onSubmit}
              >
                {student && (<input type="hidden" name="studentId" value={student.id} />)}
                <Input
                  className="mt-4 mb-4"
                  name="name"
                  label="이름"
                  defaultValue={student?.name}
                  readOnly={isPending}
                  isRequired
                />
                <Select
                  name="status"
                  label="상태"
                  defaultSelectedKeys={[student?.status || 'active']}
                  disabled={isPending}
                >
                  <SelectItem key="active">수강중</SelectItem>
                  <SelectItem key="paused">일시정지</SelectItem>
                  <SelectItem key="dropped">그만둠</SelectItem>
                </Select>
                <Textarea
                  className="mt-4"
                  name="notes"
                  label="참고사항"
                  defaultValue={student?.notes}
                  rows={5}
                />
              </Form>
            </ModalBody>
            <ModalFooter>
              {student && (
                <Button
                  color="danger"
                  variant="light"
                  onPress={() => {
                    if (confirm('수강생을 삭제합니다')) {
                      const formData = new FormData();
                      formData.set('studentId', student.id);
                      startTransition(async () => {
                        const result = await removeStudent(formData);
                        if (result.success) {
                          onClose();
                        }
                      });
                    }
                  }}
                >
                  삭제
                </Button>
              )}
              <div className="grow" />
              <Button variant="light" disabled={isPending} onPress={onClose}>
                닫기
              </Button>
              <Button
                form={formId}
                color="primary"
                type="submit"
                isLoading={isPending}
              >
                저장
              </Button>
            </ModalFooter>
          </React.Fragment>
        )}
      </ModalContent>
    </Modal>
  );
}
