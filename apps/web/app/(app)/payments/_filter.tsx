'use client';
import React from 'react';
import { Form } from '@heroui/react';
import { StudentComboBox } from '@/components/student/student-combobox';
import { useRouter, useSearchParams } from 'next/navigation';

type Props = {
  student: { id: number; name: string } | null;
};

export default function Filter({ student }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleStudentSelect = (studentId: number | '') => {
    const params = new URLSearchParams(searchParams.toString());
    if (studentId) {
      params.set('student', String(studentId));
    } else {
      params.delete('student');
    }
    router.push(`/payments?${params.toString()}`);
  };

  return (
    <Form className="flex items-end gap-3">
      <StudentComboBox
        label="수강생"
        name="student"
        placeholder="전체"
        defaultInputValue={student?.name}
        defaultSelectedKey={student?.id}
        onSelect={handleStudentSelect}
      />
    </Form>
  );
}
