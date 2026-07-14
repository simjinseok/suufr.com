'use client';
import type { CalendarDate } from '@internationalized/date';

import * as React from 'react';
import {
  Button,
  DateField,
  DatePicker,
  Description,
  Form,
  Input,
  Label,
  Modal,
  ModalProps,
  NumberField,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import { Calendar } from '@/components/calendar';
import { numberToHangulMixed } from 'es-hangul';
import { today } from '@internationalized/date';

import { createInvoice } from '@/actions/invoice';
import { useTimeZone } from '@/contexts/timezone';

interface Props {
  isOpen?: ModalProps['isOpen'];
  onOpenChange?: ModalProps['onOpenChange'];
  studentUuid: string;
}
export default function CreateInvoiceModal({ isOpen, onOpenChange, studentUuid }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content studentUuid={studentUuid} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  studentUuid: string;
  close: () => void;
}
function Content({ close, studentUuid }: ContentProps) {
  const timeZone = useTimeZone();
  const formId = React.useId();

  const [price, setPrice] = React.useState(0);
  const [startDate, setStartDateRaw] = React.useState<CalendarDate>(today(timeZone));
  const [endDate, setEndDateRaw] = React.useState<CalendarDate>(today(timeZone).add({ months: 1 }).subtract({ days: 1 }));
  // 종료일을 직접 수정하기 전까지는 시작일 기준 1달을 따라간다
  const [endDateTouched, setEndDateTouched] = React.useState(false);

  const setStartDate = (value: CalendarDate) => {
    setStartDateRaw(value);
    if (!endDateTouched) {
      setEndDateRaw(value.add({ months: 1 }).subtract({ days: 1 }));
    }
  };
  const setEndDate = (value: CalendarDate) => {
    setEndDateTouched(true);
    setEndDateRaw(value);
  };

  const [state, formAction, isPending] = React.useActionState(createInvoice, {});

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      toast.success(state.message ?? '수강권을 추가하였습니다', {
        timeout: 3000,
      });
      close();
    }
  }, [state.success, state.timestamp, state.message]);

  return (
    <>
      <Modal.Header>
        <Modal.Heading>수강권 추가</Modal.Heading>
      </Modal.Header>

      <Modal.Body>
        <Form id={formId} className="mt-4 p-1 flex flex-col gap-4" action={formAction}>
          <input type="hidden" name="studentUuid" value={studentUuid} />
          <input type="hidden" name="price" value={price} />
          <input type="hidden" name="periodStart" value={startDate.toString()} />
          <input type="hidden" name="periodEnd" value={endDate.toString()} />

          <TextField name="title">
            <Label>제목</Label>
            <Input
              variant="secondary"
              placeholder={`예: ${startDate.month}월분`}
            />
          </TextField>

          <NumberField
            variant="secondary"
            value={price}
            minValue={0}
            onInput={(event) => {
              setPrice(Number(event.currentTarget.value.replaceAll(',', '')) || 0);
            }}
          >
            <Label>금액</Label>
            <NumberField.Group>
              <NumberField.Input className="col-span-full text-right" />
            </NumberField.Group>
            <Description className="text-right">
              {numberToHangulMixed(price)}
              원
            </Description>
          </NumberField>

          <div className="flex flex-wrap gap-3">
            <DatePicker
              className="flex-1"
              value={startDate}
              granularity="day"
              onChange={(v) => v && setStartDate(v)}
              hideTimeZone
            >
              <Label>시작일</Label>
              <DateField.Group variant="secondary">
                <DateField.Input>
                  {segment => <DateField.Segment segment={segment} />}
                </DateField.Input>
                <DateField.Suffix>
                  <DatePicker.Trigger>
                    <DatePicker.TriggerIndicator />
                  </DatePicker.Trigger>
                </DateField.Suffix>
              </DateField.Group>
              <DatePicker.Popover placement="bottom left" className="min-w-fit">
                <Calendar />
              </DatePicker.Popover>
            </DatePicker>

            <DatePicker
              className="flex-1"
              value={endDate}
              granularity="day"
              onChange={(v) => v && setEndDate(v)}
              hideTimeZone
            >
              <Label>종료일</Label>
              <DateField.Group variant="secondary">
                <DateField.Input>
                  {segment => <DateField.Segment segment={segment} />}
                </DateField.Input>
                <DateField.Suffix>
                  <DatePicker.Trigger>
                    <DatePicker.TriggerIndicator />
                  </DatePicker.Trigger>
                </DateField.Suffix>
              </DateField.Group>
              <DatePicker.Popover placement="bottom right" className="min-w-fit">
                <Calendar />
              </DatePicker.Popover>
            </DatePicker>
          </div>

          <p className="text-xs text-default-500 -mt-2">
            기간 기본값은 1개월입니다. 종료일을 바꿔 자유롭게 조정할 수 있어요.
          </p>

          <TextField name="notes">
            <Label>메모 (선택)</Label>
            <TextArea variant="secondary" placeholder="수강권 메모" />
            <Description>수강생에겐 보여지지 않습니다.</Description>
          </TextField>
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="ghost" isDisabled={isPending} onPress={close}>닫기</Button>
        <Button
          variant="primary"
          isPending={isPending}
          type="submit"
          form={formId}
        >
          저장
        </Button>
      </Modal.Footer>
    </>
  );
}
