'use client';
import React from 'react';
import {Button, DateField, DateInputGroup, Form, Label} from '@heroui/react';
import { Input } from '@/components/input';
import { useSearchParams } from 'next/navigation';
import { StudentComboBox } from '@/components/student/student-combobox';
import { CalendarIcon } from 'lucide-react';

export default function Filter({ student }) {
  const formId = React.useId();
  const formRef = React.useRef<HTMLFormElement>(null);

  return (
    <Form
      ref={formRef}
      id={formId}
      className="flex items-end justify-between"
    >
      <div className="flex gap-3">
        <StudentComboBox
          label="수강생"
          name="studentId"
          defaultInputValue={student?.name}
          defaultSelectedKey={student?.id}
          // onSelect={() => {
          //   formRef.current?.requestSubmit();
          // }}
        />
        <DateField
          name="from"
        >
          <Label>시작날짜</Label>
          <DateInputGroup>
            <DateInputGroup.Prefix>
              <CalendarIcon className="size-4" />
            </DateInputGroup.Prefix>
            <DateInputGroup.Input>
              {segment => <DateInputGroup.Segment segment={segment} />}
            </DateInputGroup.Input>
          </DateInputGroup>
        </DateField>
        <DateField
          name="to"
        >
          <Label>종료날짜</Label>
          <DateInputGroup>
            <DateInputGroup.Prefix>
              <CalendarIcon className="size-4" />
            </DateInputGroup.Prefix>
            <DateInputGroup.Input>
              {segment => <DateInputGroup.Segment segment={segment} />}
            </DateInputGroup.Input>
          </DateInputGroup>
        </DateField>

      </div>
      <div>
        <Button type="submit" variant="secondary">조회</Button>
      </div>

    </Form>
  );
}
