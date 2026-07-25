'use client';
import * as React from 'react';
import { Card, Modal, Button } from '@heroui/react';
import { numberToHangulMixed } from 'es-hangul';
import { BanknoteXIcon, ChevronRightIcon, UserRoundCheckIcon, UserRoundMinusIcon } from 'lucide-react';
import Link from 'next/link';

// 미수는 학생 단위 잔액으로 판정한다 (docs/schema-redesign.md §3)
type UnpaidStudent = {
  uuid: string;
  name: string;
  outstandingAmount: number;
};

interface Props {
  currentActiveStudentCount: number;
  leftStudentsCount: number;
  unpaidStudents: UnpaidStudent[];
  unpaidStudentsCount: number;
}

export default function DashboardCards({
  currentActiveStudentCount,
  leftStudentsCount,
  unpaidStudents,
  unpaidStudentsCount,
}: Props) {
  return (
    <div className="mt-3 flex flex-col gap-3 md:grid md:grid-cols-3">
      <Card className="border border-transparent dark:border-default-100">
        <div className="flex p-2 gap-3">
          <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft">
            <UserRoundCheckIcon className="text-accent size-5" />
          </div>
          <div className="flex flex-col gap-y-2">
            <dt className="text-small font-medium text-default-500">수강중인 학생</dt>
            <dd className="text-2xl font-semibold text-default-700">
              {currentActiveStudentCount}
              명
            </dd>
          </div>
        </div>
      </Card>

      <Card className="border border-transparent dark:border-default-100">
        <div className="flex p-2 gap-3">
          <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-md bg-warning-soft">
            <UserRoundMinusIcon className="text-danger" width={20} height={20} />
          </div>
          <div className="flex flex-col gap-y-2">
            <dt className="text-small font-medium text-default-500">그만둔 수강생</dt>
            <dd className="text-2xl font-semibold text-default-700">
              {leftStudentsCount}
              명
            </dd>
          </div>
        </div>
      </Card>

      <Card className="border border-transparent dark:border-default-100">
        <div className="flex items-start p-2 gap-3">
          <div className="w-8 h-8 flex items-center justify-center rounded-md bg-danger-soft">
            <BanknoteXIcon className="text-danger size-5" />
          </div>
          <div className="grow flex flex-col gap-y-2">
            <dt className="text-small font-medium text-default-500">미납</dt>
            <dd className="text-2xl font-semibold text-default-700">
              {unpaidStudentsCount}
              명
            </dd>
          </div>
          <div className="">
            <Modal>
              <Button
                size="sm"
                variant="tertiary"
              >
                상세
              </Button>
              <Modal.Backdrop>
                <Modal.Container>
                  <Modal.Dialog className="max-w-md max-h-[80vh] flex flex-col">
                    {({ close }) => (
                      <ModalContent
                        students={unpaidStudents}
                        close={close}
                      />
                    )}
                  </Modal.Dialog>
                </Modal.Container>
              </Modal.Backdrop>
            </Modal>
          </div>
        </div>
      </Card>

    </div>
  );
}

interface ModalContentProps {
  students: UnpaidStudent[];
  close: () => void;
}

function ModalContent({ students, close }: ModalContentProps) {
  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>입금 확인이 필요한 학생</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="overflow-y-auto flex-1">
        {students.length === 0
          ? (
              <div className="flex flex-col items-center justify-center py-8 text-zinc-400">
                <BanknoteXIcon className="size-10 mb-2 opacity-50" />
                <p className="text-sm">미납 내역이 없습니다</p>
              </div>
            )
          : (
              <ul className="space-y-2">
                {students.map(student => (
                  <li key={student.uuid}>
                    <Link
                      href={`/students/${student.uuid}`}
                      className="group flex items-center justify-between p-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl transition-colors"
                    >
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {student.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums">
                          {numberToHangulMixed(student.outstandingAmount)}
                          원
                        </span>
                        <ChevronRightIcon className="size-4 text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300 transition-colors" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onPress={close}>닫기</Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
