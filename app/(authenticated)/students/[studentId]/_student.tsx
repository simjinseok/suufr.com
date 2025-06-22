'use client';
import { format } from 'date-fns/format';

import * as React from 'react';
import { Button, Card, CardBody, CardFooter, CardHeader, Divider } from '@heroui/react';
import { CircleCheckBigIcon, CircleIcon, EditIcon, PlusIcon } from 'lucide-react';
import StudentModal from '@/components/student-modal';
import StudentStatusModal from '@/components/student-status-modal';
import StatusBadge from '@/components/status-badge';

const PAYMENT_METHODS = {
  card: '카드',
  transfer: '계좌이체',
  cash: '현금',
  none: '미지정',
};
export default function Student({ student, statusHistories }) {
  const [isEditing, setIsEditing] = React.useState(false);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader className="justify-between">
          <h3 className="text-xl font-bold lg:text-xl">기본정보</h3>
          <Button isIconOnly variant="light" onPress={() => setIsEditing(true)}>
            <EditIcon width={14} height={14} />
          </Button>
        </CardHeader>
        <CardBody>
          <div>
            <StatusBadge status={student.status} />
          </div>
          <p className="mt-1 font-bold">{student.name}</p>
          <p className="mt-3 text-[12px] whitespace-pre-wrap">{student.notes}</p>
        </CardBody>
      </Card>
      <StatusHistories student={student} statusHistories={statusHistories} />
      <StudentModal
        isOpen={isEditing}
        onClose={() => { setIsEditing(false); }}
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
        <CardHeader className="justify-between">
          <h3 className="text-xl font-bold lg:text-xl">상태 변경 이력</h3>
          <Button isIconOnly variant="light" onPress={() => setEditingHistory({})}>
            <EditIcon width={14} height={14} />
          </Button>
        </CardHeader>
        <CardBody>
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
        </CardBody>
      </Card>
      <StudentStatusModal
        isOpen={editingHistory !== null}
        onClose={() => { setEditingHistory(null); }}
        student={student}
        statusHistory={statusHistories.find(statusHistory => statusHistory.id === editingHistory?.id)}
      />
    </React.Fragment>
  );
}
