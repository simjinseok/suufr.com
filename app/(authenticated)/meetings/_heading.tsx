import React from 'react';
import { Button, Modal } from '@heroui/react';

import CreateMeetingModal from '@/components/meeting/create-meeting-modal';

export default function Heading() {
  return (
    <div className="flex justify-between">
      <h1 className="text-2xl font-bold">상담 내역</h1>
      <Modal>
        <Button>추가</Button>
        <CreateMeetingModal />
      </Modal>
    </div>
  );
}
