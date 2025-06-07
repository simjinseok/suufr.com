'use client';
import { CircleCheckBigIcon, CircleIcon, EditIcon, PlusIcon } from 'lucide-react';
import { Button, Card, CardBody, CardFooter, CardHeader, Divider } from '@heroui/react';
import React from 'react';
import type { TLesson } from '@/types/index';
import { Text } from '@/components/text';
import StudentModal from '@/components/student-modal';
import StatusBadge from '@/components/status-badge';

const PAYMENT_METHODS = {
  card: '카드',
  transfer: '계좌이체',
  cash: '현금',
  none: '미지정',
};
export default function Student({ student }) {
  const [isEditing, setIsEditing] = React.useState(false);

  return (
    <React.Fragment>
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
      <StudentModal
        isOpen={isEditing}
        onClose={() => { setIsEditing(false); }}
        student={student}
      />
    </React.Fragment>
  );
}
