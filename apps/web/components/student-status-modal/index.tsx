import React from 'react';
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

import { createStudentStatus, updateStudentStatus } from '@/actions/student-status';
import StatusBadge from '@/components/status-badge';

export default function StudentStatusModal({ isOpen, onClose, student, studentStatus }) {
  const formId = React.useId();

  const [isPending, startTransition] = React.useTransition();

  const onSubmit = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    startTransition(async () => {
      const result = studentStatus ? await updateStudentStatus({}, formData) : await createStudentStatus({}, formData);
      if (result.success) {
        onClose();
      }
    });
  }, [studentStatus, onClose]);

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <ModalContent>
        {onClose => (
          <React.Fragment>
            <ModalHeader>{student ? '상태 정보 변경' : '수강생 상태 변경'}</ModalHeader>
            <ModalBody>
              <Form
                id={formId}
                onSubmit={onSubmit}
              >
                {studentStatus
                  ? (
                      <input type="hidden" name="studentStatusId" value={studentStatus.id} />
                    )
                  : (<input type="hidden" name="studentId" value={student.id} />)}
                <div className="w-full">
                  {studentStatus
                    ? (
                        <StatusBadge status={studentStatus.status} />
                      )
                    : (
                        <Select
                          name="status"
                          label="상태"
                          defaultSelectedKeys={[student?.status || 'active']}
                          disabledKeys={[student.status]}
                          disabled={isPending}
                        >
                          <SelectItem key="pending">대기중</SelectItem>
                          <SelectItem key="active">수강중</SelectItem>
                          <SelectItem key="paused">일시정지</SelectItem>
                          <SelectItem key="leave">그만둠</SelectItem>
                        </Select>
                      )}
                </div>
                <Textarea
                  className="mt-4"
                  name="notes"
                  label="참고사항"
                  defaultValue={studentStatus?.notes}
                  rows={5}
                />
              </Form>
            </ModalBody>
            <ModalFooter>
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
