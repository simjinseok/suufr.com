'use client';
import * as React from 'react';
import {
  Button,
  Checkbox,
  DateField,
  DateInputGroup,
  Form,
  Label,
  Modal,
  TextArea,
  TextField,
} from '@heroui/react';
import { fromDate, toCalendarDateTime } from '@internationalized/date';
import { Controller, useForm } from 'react-hook-form';
import { CalendarIcon } from 'lucide-react';
import { updateSession, removeSession } from '@/actions/session';

export default function EditSessionModal({ isOpen, onOpenChange, session }) {
  const formId = React.useId();
  const { control } = useForm({
    values: {
      isDone: session.isDone,
      lessonAt: toCalendarDateTime(fromDate(session.lessonAt, 'Asia/Seoul')),
      notes: session.notes,
    },
  });

  const [state, formAction, isPending] = React.useActionState(updateSession, {});

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.message) {
      alert(state.message);
    }

    if (state.success) {
      onOpenChange(false);
    }
  }, [state.success, state.message, state.timestamp]);

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <React.Fragment>
              <Modal.Header>
                <Modal.Heading>세션 수정</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <Form id={formId} className="p-1 flex flex-col gap-4" action={formAction}>
                  <input type="hidden" name="sessionId" value={session.id} />
                  <Controller
                    control={control}
                    name="isDone"
                    render={({ field: { name, value, onChange } }) => (
                      <Checkbox className="inline-flex" name={name} isSelected={value} onChange={onChange} value="on">
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <Checkbox.Content>
                          완료여부
                        </Checkbox.Content>
                      </Checkbox>
                    )}
                  />
                  <Controller
                    control={control}
                    name="lessonAt"
                    render={({ field: { name, value, onChange } }) => (
                      <DateField
                        name={name}
                        granularity="minute"
                        value={value}
                        onChange={onChange}
                        hideTimeZone
                      >
                        <Label>날짜</Label>
                        <DateInputGroup>
                          <DateInputGroup.Prefix>
                            <CalendarIcon className="size-4" />
                          </DateInputGroup.Prefix>
                          <DateInputGroup.Input>
                            {segment => <DateInputGroup.Segment segment={segment} />}
                          </DateInputGroup.Input>
                        </DateInputGroup>
                      </DateField>
                    )}
                  />
                  <Controller
                    control={control}
                    name="notes"
                    render={({ field: { name, value, onChange } }) => (
                      <TextField
                        name={name}
                        value={value}
                        onChange={onChange}
                      >
                        <Label>메모</Label>
                        <TextArea rows={5} className="resize-none" />
                      </TextField>
                    )}
                  />
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <RemoveButton sessionId={session.id} onSuccess={close} />
                <div className="grow" />
                <Button variant="ghost" isDisabled={isPending} onClick={close}>닫기</Button>
                <Button type="submit" form={formId} variant="primary" isPending={isPending}>저장</Button>
              </Modal.Footer>
            </React.Fragment>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function RemoveButton({ sessionId, onSuccess }: { onSuccess: () => void }) {
  const [state, formAction, isPending] = React.useActionState(removeSession, {});

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      alert(state.message);
      if (typeof onSuccess === 'function') onSuccess();
    }
  }, [state.success, state.timestamp, state.message, onSuccess]);

  return (
    <Modal>
      <Button variant="danger-soft">삭제</Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            {({ close }) => (
              <React.Fragment>
                <Modal.Header>
                  <Modal.Heading>삭제 확인</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  해당 수업을 삭제합니다.
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="ghost" isDisabled={isPending} onClick={close}>취소</Button>
                  <Form action={formAction}>
                    <input type="hidden" name="sessionId" value={sessionId} />
                    <Button type="submit" variant="danger" isPending={isPending}>삭제</Button>
                  </Form>
                </Modal.Footer>
              </React.Fragment>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
