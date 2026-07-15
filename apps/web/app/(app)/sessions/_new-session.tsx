'use client';

import * as React from 'react';
import { Button } from '@heroui/react';
import { PlusIcon } from 'lucide-react';

import StudentPickerModal from '@/components/student/student-picker-modal';
import CreateSessionModal from '@/components/sessions/create-session-modal';

export default function NewSession() {
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);
  const [studentUuid, setStudentUuid] = React.useState<string | null>(null);

  return (
    <React.Fragment>
      <Button variant="primary" size="sm" onPress={() => setIsPickerOpen(true)}>
        <PlusIcon className="size-4" />
        수업 추가
      </Button>
      <StudentPickerModal
        isOpen={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        heading="수업 추가"
        onPick={(student) => {
          setIsPickerOpen(false);
          setStudentUuid(student.uuid);
        }}
      />
      {studentUuid && (
        <CreateSessionModal
          isOpen={!!studentUuid}
          onOpenChange={(open) => {
            if (!open) setStudentUuid(null);
          }}
          studentUuid={studentUuid}
        />
      )}
    </React.Fragment>
  );
}
