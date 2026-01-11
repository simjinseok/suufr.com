'use client';
import * as React from 'react';
import { Button, Form, Surface } from '@heroui/react';
import { StudentComboBox } from '@/components/student/student-combobox';

export default function SearchForm({ student }) {
  return (
    <Surface className="mt-4" variant="default">
      <Form className="flex items-end justify-between">
        <div className="flex items-end gap-3">
          <StudentComboBox
            label="수강생"
            name="studentId"
            defaultInputValue={student?.name}
            defaultSelectedKey={student?.id}
          />
          <Button type="submit">조회</Button>
        </div>
        <div className="flex justify-end">

        </div>
      </Form>
    </Surface>
  );
}
