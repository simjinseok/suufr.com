'use client';
import type { ZonedDateTime } from '@internationalized/date';
import { Description, ModalProps, Tooltip } from '@heroui/react';

import * as React from 'react';
import {
  Button, Chip,
  DateField, DateInputGroup,
  Form,
  Input,
  Label,
  Modal,
  NumberField,
  Surface,
  Tag,
  TagGroup,
  TextArea,
  TextField,
} from '@heroui/react';
import { CalendarIcon, InfoIcon } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { now } from '@internationalized/date';

import { createLesson } from '@/actions/lesson';
import { useHourCycle } from '@/contexts/time-format';

interface Props {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  studentId: string;
}
export default function CreateLessonModal({ isOpen, onOpenChange, studentId }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content studentId={studentId} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  studentId: string;
  close: () => void;
}
function Content({ close, studentId }: ContentProps) {
  const formId = React.useId();
  const [state, formAction, isPending] = React.useActionState(createLesson, {
    fields: {
      title: '',
      notes: '',
    },
  });
  const { control } = useForm({
    values: {
      title: state.fields?.title,
      notes: state.fields?.notes,
    },
  });

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      alert(state.message);
      close();
    }
  }, [state.success, state.timestamp, state.message]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>레슨 추가</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form id={formId} className="mt-4 p-1 flex flex-col gap-4" action={formAction}>
          <input type="hidden" name="studentId" value={studentId} />

          <Controller
            control={control}
            name="title"
            render={({ field: { name, value, onChange } }) => (
              <TextField
                name={name}
                value={value}
                onInput={(event) => {
                  onChange(event.currentTarget.value);
                }}
              >
                <Label>제목</Label>
                <Input />
              </TextField>
            )}
          />

          <Controller
            control={control}
            name="notes"
            render={({ field: { name, value, onChange } }) => (
              <TextField name={name} value={value} onInput={event => onChange(event.currentTarget.value)}>
                <Label>
                  내용
                </Label>
                <TextArea placeholder="레슨 내용" />
                <Description>레슨 내용을 입력해보세요. 수강생에겐 보여지지 않습니다.</Description>
              </TextField>
            )}
          />
          <LessonsGenerator />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" isDisabled={isPending} onClick={close}>닫기</Button>
        <Button variant="primary" isPending={isPending} type="submit" form={formId}>저장</Button>
      </Modal.Footer>
    </React.Fragment>
  );
}

function LessonsGenerator() {
  const hourCycle = useHourCycle();
  const [date, setDate] = React.useState<ZonedDateTime | null>(now('Asia/Seoul'));
  const [count, setCount] = React.useState(4);
  const [days, setDays] = React.useState(new Set());

  const lessons = React.useMemo(() => {
    if (!date || days.size === 0) return [];

    const result: ZonedDateTime[] = [];
    const selectedDays = Array.from(days).map(d => Number(d)).sort((a, b) => a - b);

    let currentDate = date;

    while (result.length < count) {
      // 현재 날짜의 요일 (0=일, 1=월, ..., 6=토)
      const dayOfWeek = currentDate.toDate().getDay();

      // 선택된 요일에 해당하면 추가
      if (selectedDays.includes(dayOfWeek)) {
        result.push(currentDate);
      }

      // 다음 날로 이동
      currentDate = currentDate.add({ days: 1 });
    }

    return result;
  }, [date, count, days]);

  return (
    <Surface className="pt-3 pb-2 px-2 rounded-xl" variant="secondary">
      수업
      <Surface className="mt-2 p-2 flex flex-col gap-2  rounded-xl" variant="default">
        <div className="flex gap-1">
          <DateField value={date} onChange={setDate} hourCycle={hourCycle} hideTimeZone>
            <Label>기준 날짜</Label>
            <DateInputGroup>
              <DateInputGroup.Prefix>
                <CalendarIcon className="size-4" />
              </DateInputGroup.Prefix>
              <DateInputGroup.Input>
                {segment => <DateInputGroup.Segment segment={segment} />}
              </DateInputGroup.Input>
            </DateInputGroup>
          </DateField>
          <NumberField value={count} minValue={1} maxValue={20} onChange={value => setCount(value)}>
            <Label>횟수</Label>
            <NumberField.Group>
              <NumberField.DecrementButton />
              <NumberField.Input className="w-10 text-center" />
              <NumberField.IncrementButton />
            </NumberField.Group>
          </NumberField>
        </div>
        <TagGroup size="lg" selectionMode="multiple" selectedKeys={days} onSelectionChange={setDays}>
          <Label>요일</Label>
          <TagGroup.List>
            <Tag id="0" textValue="0">일</Tag>
            <Tag id="1" textValue="1">월</Tag>
            <Tag id="2" textValue="2">화</Tag>
            <Tag id="3" textValue="3">수</Tag>
            <Tag id="4" textValue="4">목</Tag>
            <Tag id="5" textValue="5">금</Tag>
            <Tag id="6" textValue="6">토</Tag>
          </TagGroup.List>
        </TagGroup>

        {Array.isArray(lessons) && lessons.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {lessons.map((lesson, idx) => (
              <DateField
                key={`lesson-${lesson.toString()}`}
                aria-label={`${idx + 1}번째 수업`}
                className="tabular-nums"
                name={`lesson[${idx}]`}
                value={lesson}
                hourCycle={hourCycle}
                isReadOnly
                hideTimeZone
              >
                <DateInputGroup>
                  <DateInputGroup.Prefix>
                    {idx + 1}
                    회차
                  </DateInputGroup.Prefix>
                  <DateInputGroup.Input>
                    {segment => <DateInputGroup.Segment segment={segment} />}
                  </DateInputGroup.Input>
                  <DateInputGroup.Suffix>
                    <Chip color="accent">{lesson.toDate().toLocaleDateString('ko-KR', { weekday: 'long' })}</Chip>
                  </DateInputGroup.Suffix>
                </DateInputGroup>
              </DateField>
            ))}
          </div>
        )}
      </Surface>

    </Surface>
  );
}
