'use client';
import React from 'react';
import { Button, Modal } from '@heroui/react';
import CreateStudentModal from '@/components/student/create-student-modal';

export default function NewStudentModal() {

  return (
    <Modal>
      <Button variant="primary">
        수강생 등록
      </Button>
      <CreateStudentModal />
    </Modal>
  );
}
