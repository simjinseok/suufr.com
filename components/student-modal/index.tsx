import React from 'react';
import { EllipsisVerticalIcon, LoaderIcon } from 'lucide-react';
import {
  Button,
  Form,
  Modal,
  Input,
  Select,
  TextArea,
  ListBox,
  TextField,
  Label,
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
      <Modal.Container>
        <Modal.Dialog className="min-w-[320px]">
          {({ close }) => (
            <React.Fragment>
              <Modal.Header>
                <Modal.Heading>{student ? '수강생 정보 수정' : '수강생 추가'}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <Form
                  id={formId}
                  onSubmit={onSubmit}
                >
                  {student && (<input type="hidden" name="studentId" value={student.id} />)}
                  <TextField
                    name="name"
                    defaultValue={student?.name}
                    isRequired
                  >
                    <Label>이름</Label>
                    <Input
                      readOnly={isPending}
                    />
                  </TextField>
                  {!student && (
                    <Select
                      className="mt-4"
                      name="status"
                      value={student?.status || 'active'}
                      isDisabled={isPending}
                    >
                      <Label>상태</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="pending">
                            대기중
                          </ListBox.Item>
                          <ListBox.Item id="active">
                            수강중
                          </ListBox.Item>
                          <ListBox.Item id="paused">
                            일시정지
                          </ListBox.Item>
                          <ListBox.Item id="leave">
                            그만둠
                          </ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  )}
                  <TextField className="mt-4" name="notes">
                    <Label>참고사항</Label>
                    <TextArea
                      defaultValue={student?.notes}
                      rows={5}
                    />
                  </TextField>
                </Form>
              </Modal.Body>
              <Modal.Footer>
                {student && (
                  <Button
                    variant="danger"
                    onPress={() => {
                      if (confirm('수강생을 삭제합니다')) {
                        const formData = new FormData();
                        formData.set('studentId', student.id);
                        startTransition(async () => {
                          const result = await removeStudent(formData);
                          if (result.success) {
                            close();
                          }
                        });
                      }
                    }}
                  >
                    삭제
                  </Button>
                )}
                <div className="grow" />
                <Button variant="ghost" isDisabled={isPending} onPress={onClose}>
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
    </Modal>
  );
}
