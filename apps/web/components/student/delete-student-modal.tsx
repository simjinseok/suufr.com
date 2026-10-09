'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal, ModalProps, Spinner, Surface, toast } from '@heroui/react';
import { AlertTriangle } from 'lucide-react';

import { removeStudent } from '@/actions/student';
import type { Student } from '@/types/index';

type StudentRecords = {
  sessionCount: number;
  invoiceCount: number;
  paymentCount: number;
};

interface Props {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  student: Student;
}

// 잘못 만든 수강생을 지우는 용도. 이력을 남기려면 상태를 '그만둠'으로 바꾸도록 안내한다
export default function DeleteStudentModal({ isOpen, onOpenChange, student }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container className="max-w-sm">
        <Modal.Dialog>
          {({ close }) => <Content student={student} close={close} />}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  student: Student;
  close: () => void;
}

function Content({ student, close }: ContentProps) {
  const router = useRouter();
  const [records, setRecords] = React.useState<StudentRecords | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch(`/api/students/${student.uuid}/records`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('failed');

        const json = await response.json();
        setRecords(json.data);
        setIsLoading(false);
      }
      catch (error) {
        if ((error as Error).name !== 'AbortError') {
          // 건수를 못 불러와도 삭제는 막지 않는다 — 일반 경고 문구로 대신한다
          setRecords(null);
          setIsLoading(false);
        }
      }
    };

    load();
    return () => controller.abort();
  }, [student.uuid]);

  const handleDelete = async () => {
    setIsDeleting(true);

    const result = await removeStudent(student.uuid);

    if (result.success) {
      toast.success('수강생을 삭제하였습니다.', { timeout: 3000 });
      close();
      router.push('/students');
      return;
    }

    toast.danger('삭제 실패', {
      description: result.message || '수강생 삭제에 실패했습니다.',
      timeout: 3000,
    });
    setIsDeleting(false);
  };

  const recordParts = records
    ? [
        records.sessionCount > 0 && `수업 ${records.sessionCount}개`,
        records.invoiceCount > 0 && `수강권 ${records.invoiceCount}개`,
        records.paymentCount > 0 && `결제 ${records.paymentCount}건`,
      ].filter(Boolean)
    : [];
  const hasRecords = recordParts.length > 0;

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading className="flex items-center gap-2 text-danger">
          <AlertTriangle className="w-5 h-5" />
          수강생 삭제
        </Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <div className="flex flex-col gap-3 text-sm text-gray-600">
          <p>
            <span className="font-medium text-foreground">{student.name}</span>
            {' '}
            수강생을 삭제하시겠습니까? 잘못 만든 수강생을 정리할 때 사용하세요.
          </p>
          {isLoading
            ? (
                <div className="flex justify-center py-2">
                  <Spinner size="sm" />
                </div>
              )
            : (hasRecords || !records) && (
                <Surface className="p-3 rounded-lg bg-danger-soft text-danger">
                  <p className="font-medium flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    주의
                  </p>
                  <p className="mt-1">
                    {hasRecords
                      ? `${recordParts.join(', ')}도 함께 사라지고 매출에서도 빠집니다.`
                      : '이 수강생의 수업·수강권·결제도 함께 사라지고 매출에서도 빠집니다.'}
                    {' '}
                    수업을 그만둔 수강생이라면 삭제 대신 상태를 &apos;그만둠&apos;으로 바꿔 기록을 남겨주세요.
                  </p>
                </Surface>
              )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onPress={close} isDisabled={isDeleting}>
          취소
        </Button>
        <Button
          variant="danger"
          onPress={handleDelete}
          isPending={isDeleting}
          isDisabled={isLoading}
        >
          삭제
        </Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
