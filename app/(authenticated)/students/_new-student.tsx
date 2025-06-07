'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@heroui/react';
import StudentModal from '@/components/student-modal';

import { createStudent } from './actions';

export default function NewStudentModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <Button
        color="secondary"
        onPress={setIsOpen.bind(null, true)}
        disabled={isOpen}
      >
        수강생 등록
      </Button>
      <StudentModal
        isOpen={isOpen}
        onClose={setIsOpen.bind(null, false)}
        action={createStudent}
      />
    </>
  );
}
