'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@heroui/react';
import CreateStudentModal from './_create-student-modal';

export default function NewStudentModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <Button
        variant="primary"
        onPress={setIsOpen.bind(null, true)}
        isDisabled={isOpen}
      >
        수강생 등록
      </Button>
      {isOpen && (
        <CreateStudentModal
          isOpen={isOpen}
          onOpenChange={setIsOpen}
        />
      )}
    </>
  );
}
