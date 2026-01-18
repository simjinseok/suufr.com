'use client';
import { format } from 'date-fns/format';

import * as React from 'react';
import { Avatar, Button, ButtonGroup, Card, Dropdown, Header, Modal } from '@heroui/react';
import { ChevronDownIcon, EditIcon } from 'lucide-react';
import StatusBadge from '@/components/status-badge';
import EditStudentModal from '@/components/student/edit-student-modal';
import ChangeStatusModal from './_change-status-modal';
import StatusModal from './_status-modal';

function getProfileImageUrl(studentUuid: string): string {
  return `/api/students/${studentUuid}/profile-image.webp`;
}

const PAYMENT_METHODS = {
  card: '카드',
  transfer: '계좌이체',
  cash: '현금',
  none: '미지정',
};
export default function Student({ student, statuses }) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [isEditingStatus, setIsEditingStatus] = React.useState(false);
  const [isStatusHistoryOpen, setIsStatusHistoryOpen] = React.useState(false);

  return (
    <div className="mb-3 min-h-20 flex justify-between">
      <div className="flex gap-3">
        <Avatar size="lg" className="shrink-0">
          {student.profileImageUrl
            ? <Avatar.Image src={getProfileImageUrl(student.uuid)} alt={student.name} />
            : null}
          <Avatar.Fallback>{student.name.charAt(student.name.length - 1)}</Avatar.Fallback>
        </Avatar>
        <div>
          <StatusBadge status={student.status} />
          <div className="flex items-center gap-1">
            <h2 className="text-lg font-bold">
              {student.name}
            </h2>

          </div>
          <p className="text-sm text-gray-600 font-medium whitespace-pre-wrap">{student.notes}</p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <ButtonGroup variant="secondary">
          <Modal>
            <Button>
              <EditIcon />
              수정
            </Button>
            <EditStudentModal student={student} />
          </Modal>
          <Dropdown>
            <Button><ChevronDownIcon /></Button>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu
                selectionMode="none"
                onAction={(key) => {
                  if (key === 'change-status') {
                    setIsEditingStatus(true);
                  }
                  else if (key === 'change-status-history') {
                    setIsStatusHistoryOpen(true);
                  }
                }}
              >
                <Dropdown.Section>
                  <Header>상태</Header>
                  <Dropdown.Item id="change-status">
                    상태변경
                  </Dropdown.Item>
                  <Dropdown.Item id="change-status-history">
                    상태변경내역
                  </Dropdown.Item>
                </Dropdown.Section>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </ButtonGroup>
      </div>
      <ChangeStatusModal
        isOpen={isEditingStatus}
        onOpenChange={setIsEditingStatus}
        student={student}
      />
      <StatusModal
        isOpen={isStatusHistoryOpen}
        onOpenChange={setIsStatusHistoryOpen}
        statuses={statuses}
      />
    </div>
  );
}
