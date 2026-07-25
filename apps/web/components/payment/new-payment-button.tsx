'use client';

import * as React from 'react';
import { Button } from '@heroui/react';
import { PlusIcon } from 'lucide-react';

import StudentPickerModal from '@/components/student/student-picker-modal';
import PaymentModal from '@/components/invoice/payment-modal';

export default function NewPaymentButton() {
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);
  const [studentUuid, setStudentUuid] = React.useState<string | null>(null);

  return (
    <React.Fragment>
      <Button variant="primary" size="sm" onPress={() => setIsPickerOpen(true)}>
        <PlusIcon className="size-4" />
        입금 기록
      </Button>
      <StudentPickerModal
        isOpen={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        heading="입금 기록"
        onPick={(student) => {
          setIsPickerOpen(false);
          setStudentUuid(student.uuid);
        }}
      />
      {studentUuid && (
        <PaymentModal
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
