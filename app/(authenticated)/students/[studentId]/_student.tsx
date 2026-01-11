'use client';
import { format } from 'date-fns/format';

import * as React from 'react';
import { Avatar, Button, Card } from '@heroui/react';
import { EditIcon } from 'lucide-react';
import StatusBadge from '@/components/status-badge';
import EditStudentModal from './_edit-student-modal';
import ChangeStatusModal from './_change-status-modal';

const PAYMENT_METHODS = {
  card: '카드',
  transfer: '계좌이체',
  cash: '현금',
  none: '미지정',
};
export default function Student({ student }) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [isEditingStatus, setIsEditingStatus] = React.useState(false);

  return (
    <div className="mb-3 min-h-20 flex justify-between">
      <div className="flex gap-3">
        <Avatar>
          <Avatar.Fallback>{student.name}</Avatar.Fallback>
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
      <div className="flex gap-2">
        <Button variant="danger-soft" onClick={() => setIsEditingStatus(true)}>상태변경</Button>
        <Button variant="secondary" onClick={() => setIsEditing(true)}>
          <EditIcon />
          수정
        </Button>
      </div>
      {isEditing && (
        <EditStudentModal isOpen={isEditing} onOpenChange={setIsEditing} student={student} />
      )}
      <ChangeStatusModal
        isOpen={isEditingStatus}
        onOpenChange={setIsEditingStatus}
        student={student}
      />
    </div>
  );
}

function StatusHistories({ student, statusHistories }) {
  const [editingHistory, setEditingHistory] = React.useState(null);

  return (
    <React.Fragment>
      <Card>
        <Card.Header className="justify-between">
          <h3 className="text-xl font-bold lg:text-xl">상태 변경 이력</h3>
          <Button isIconOnly variant="light" onPress={() => setEditingHistory({})}>
            <EditIcon width={14} height={14} />
          </Button>
        </Card.Header>
        <Card.Content>
          <ol className="flex flex-col gap-3">
            {statusHistories.map(statusHistory => (
              <li key={`status-history-${statusHistory.id}`}>
                <div className="flex items-center gap-1">
                  <StatusBadge status={statusHistory.status} />
                  <p className="text-xs text-gray-500 font-bold">{format(statusHistory.changedAt, 'yyyy-MM-dd')}</p>
                  <div className="grow" />
                  <Button isIconOnly size="sm" variant="light" onPress={() => setEditingHistory(statusHistory)}>
                    <EditIcon size={14} />
                  </Button>
                </div>
                <p className="mt-1 text-sm whitespace-pre-wrap">{statusHistory.notes}</p>
              </li>
            ))}
          </ol>
        </Card.Content>
      </Card>

    </React.Fragment>
  );
}
