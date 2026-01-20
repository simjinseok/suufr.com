'use client';
import { ModalProps, Popover, TimeField } from '@heroui/react';

import * as React from 'react';
import {
  Button,
  Checkbox,
  DateField,
  DateInputGroup,
  Description,
  Form,
  Label,
  Modal,
  NumberField,
  Tabs,
  TextArea,
  TextField,
} from '@heroui/react';
import { fromDate, toCalendarDate, toCalendarDateTime } from '@internationalized/date';
import { Controller, useForm } from 'react-hook-form';
import { CalendarIcon } from 'lucide-react';
import { updateSession, removeSession } from '@/actions/session';
import { TSession } from '@/types/index';
import { useHourCycle } from '@/contexts/time-format';
import { Calendar } from '@/components/calendar';

interface Props {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  session: TSession;
}
export default function EditSessionModal({ isOpen, onOpenChange, session }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content session={session} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  session: Props['session'];
  close: () => void;
}
function Content({ session, close }: ContentProps) {
  const formId = React.useId();
  const hourCycle = useHourCycle();
  const [selectedTab, setSelectedTab] = React.useState<'basic' | 'memo' | 'feedback'>('basic');
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);

  const [state, formAction, isPending] = React.useActionState(updateSession, {
    fields: {
      isDone: session?.isDone,
      sessionAt: session.sessionAt,
      duration: session?.duration,
      notes: session?.notes,
      feedback: session?.feedback?.notes,
    },
  });
  const { control, watch } = useForm({
    values: {
      isDone: state.fields?.isDone,
      sessionAt: state.fields?.sessionAt,
      duration: state.fields?.duration,
      notes: state.fields?.notes,
      feedback: state.fields?.feedback,
    },
  });

  const isDoneValue = watch('isDone');

  // isDone이 false가 되면 memo 탭으로 전환
  React.useEffect(() => {
    if (!isDoneValue && selectedTab === 'feedback') {
      setSelectedTab('memo');
    }
  }, [isDoneValue, selectedTab]);

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.message) {
      alert(state.message);
    }

    if (state.success) {
      close();
    }
  }, [state.success, state.message, state.timestamp]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>세션 수정</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          id={formId}
          className="p-1 flex flex-col gap-4"
          action={formAction}
          validationErrors={state.fieldErrors}
        >
          <input type="hidden" name="sessionId" value={session.id} />
          <React.Activity mode={selectedTab === 'basic' ? 'visible' : 'hidden'}>
            <Controller
              control={control}
              name="isDone"
              render={({ field: { name, value, onChange } }) => (
                <Checkbox className="inline-flex" name={name} isSelected={value} onChange={onChange} value="on">
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Checkbox.Content>
                    <Label>완료여부</Label>
                  </Checkbox.Content>
                </Checkbox>
              )}
            />
            <Controller
              control={control}
              name="sessionAt"
              render={({ field: { name, value, onChange } }) => (
                <div className="flex gap-1">
                  <DateField
                    name={name}
                    granularity="day"
                    value={toCalendarDateTime(fromDate(value, 'Asia/Seoul'))}
                    onChange={(date) => {
                      if (date) {
                        onChange(date.toDate('Asia/Seoul'));
                      }
                    }}
                    hourCycle={hourCycle}
                    hideTimeZone
                    isRequired
                  >
                    <Label>날짜</Label>
                    <div className="flex items-center gap-1">
                      <Popover isOpen={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <Button
                          className="rounded-field"
                          size="sm"
                          isIconOnly
                          variant="tertiary"
                        >
                          <CalendarIcon className="size-4" />
                        </Button>
                        <Popover.Content placement="bottom left">
                          <Popover.Dialog>
                            <Calendar
                              value={toCalendarDateTime(fromDate(value, 'Asia/Seoul'))}
                              onChange={(newDate) => {
                                if (newDate) {
                                  onChange(newDate.toDate('Asia/Seoul'));
                                  setIsCalendarOpen(false);
                                }
                              }}
                            />
                          </Popover.Dialog>
                        </Popover.Content>
                      </Popover>
                      <DateInputGroup>
                        <DateInputGroup.Input>
                          {segment => <DateInputGroup.Segment segment={segment} />}
                        </DateInputGroup.Input>
                      </DateInputGroup>
                    </div>
                  </DateField>
                  <TimeField
                    hourCycle={hourCycle}
                    granularity="minute"
                    value={toCalendarDateTime(fromDate(value, 'Asia/Seoul'))}
                    onChange={(newDate) => {
                      if (newDate) {
                        onChange(newDate.toDate('Asia/Seoul'));
                      }
                    }}
                    hideTimeZone
                  >
                    <Label>시간</Label>
                    <DateInputGroup>
                      <DateInputGroup.Input>
                        {segment => <DateInputGroup.Segment segment={segment} />}
                      </DateInputGroup.Input>
                    </DateInputGroup>
                  </TimeField>
                </div>
              )}
            />
            <Controller
              control={control}
              name="duration"
              render={({ field: { name, value, onChange } }) => (
                <NumberField
                  name={name}
                  value={value}
                  onChange={onChange}
                  minValue={5}
                  step={5}
                >
                  <Label>수업 시간 (분)</Label>
                  <NumberField.Group>
                    <NumberField.DecrementButton />
                    <NumberField.Input />
                    <NumberField.IncrementButton />
                  </NumberField.Group>
                </NumberField>
              )}
            />
          </React.Activity>

          <React.Activity mode={selectedTab === 'memo' ? 'visible' : 'hidden'}>
            <Controller
              control={control}
              name="notes"
              render={({ field: { name, value, onChange } }) => (
                <TextField
                  name={name}
                  value={value}
                  onChange={onChange}
                >
                  <Label className="sr-only">메모</Label>
                  <TextArea rows={5} className="resize-none" />
                  <Description>수강생에게 노출되지 않는 수업 메모입니다</Description>
                </TextField>
              )}
            />
          </React.Activity>

          <React.Activity mode={selectedTab === 'feedback' ? 'visible' : 'hidden'}>
            <Controller
              control={control}
              name="feedback"
              render={({ field: { name, value, onChange } }) => (
                <TextField name={name} value={value} onChange={onChange}>
                  <Label className="sr-only">피드백</Label>
                  <TextArea rows={5} className="resize-none" />
                  <Description>수강생에게 보여줄 피드백입니다</Description>
                </TextField>
              )}
            />
          </React.Activity>
        </Form>
        <Tabs
          className="mt-4"
          selectedKey={selectedTab}
          onSelectionChange={(key) => setSelectedTab(key as 'basic' | 'memo' | 'feedback')}
        >
          <Tabs.ListContainer>
            <Tabs.List>
              <Tabs.Tab id="basic">
                기본정보
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="memo">
                수업내용
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="feedback" isDisabled={!isDoneValue}>
                피드백
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <RemoveButton sessionId={session.id} onSuccess={close} />
        <div className="grow" />
        <Button variant="ghost" isDisabled={isPending} onClick={close}>닫기</Button>
        <Button type="submit" form={formId} variant="primary" isPending={isPending}>저장</Button>
      </Modal.Footer>
    </React.Fragment>
  );
}

interface RemoveButtonProps {
  sessionId: Props['session']['id'];
  onSuccess: () => void;
}
function RemoveButton({ sessionId, onSuccess }: RemoveButtonProps) {
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
