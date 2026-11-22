'use client';
import * as React from 'react';
import { Button, Card, Modal } from '@heroui/react';
import { BanknoteXIcon, ChevronRightIcon, UsersRoundIcon } from 'lucide-react';
import clsx from 'clsx';
import type { UnpaidInvoice } from '@/utils/api/dashboard';
import { invoicePeriodLabel } from '@/utils/invoice-label';
import { todayString } from '@/utils/dashboard/month-param';
import { elapsedLabel, sumPrice } from '@/utils/dashboard/unpaid';

interface Props {
  activeStudentCount: number;
  unpaidInvoices: UnpaidInvoice[];
  timezone: string;
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

export default function SummaryCards({ activeStudentCount, unpaidInvoices, timezone }: Props) {
  const unpaidCount = unpaidInvoices.length;
  const isDue = unpaidCount > 0;

  return (
    <div className="flex gap-3">
      <SummaryCard
        icon={<UsersRoundIcon className="size-5" />}
        label="수강중인 학생"
        value={activeStudentCount}
        unit="명"
      />

      <SummaryCard
        icon={<BanknoteXIcon className="size-5" />}
        label="미납"
        value={unpaidCount}
        unit="건"
        tone={isDue ? 'danger' : 'default'}
        action={isDue && (
          <Modal>
            <Button size="sm" variant="ghost" className="ml-auto -mr-1 gap-0.5 px-1 text-xs font-semibold">
              상세보기
              <ChevronRightIcon className="size-3.5" />
            </Button>
            <Modal.Backdrop>
              <Modal.Container>
                <Modal.Dialog className="max-w-[480px] max-h-[80vh] flex flex-col p-0 gap-0">
                  <UnpaidModalContent invoices={unpaidInvoices} timezone={timezone} />
                </Modal.Dialog>
              </Modal.Container>
            </Modal.Backdrop>
          </Modal>
        )}
      />
    </div>
  );
}

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  tone?: 'default' | 'danger';
  action?: React.ReactNode;
}

function SummaryCard({ icon, label, value, unit, tone = 'default', action }: SummaryCardProps) {
  return (
    <Card className="flex-1 sm:flex-none sm:min-w-[188px] min-w-0 flex-row items-center gap-3 rounded-lg border border-border py-3 pl-3 pr-4 shadow-none">
      <span
        aria-hidden="true"
        className={clsx(
          'grid size-[38px] shrink-0 place-items-center rounded-lg',
          tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-default text-muted',
        )}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-px leading-tight">
        <h2 className="text-xs font-semibold text-muted">{label}</h2>
        <p className={clsx('text-[22px] font-bold tabular-nums', tone === 'danger' ? 'text-danger' : 'text-foreground')}>
          {value}
          <small className="ml-0.5 text-[13px] font-medium text-muted">{unit}</small>
        </p>
      </div>
      {action}
    </Card>
  );
}

interface UnpaidModalContentProps {
  invoices: UnpaidInvoice[];
  timezone: string;
}

function UnpaidModalContent({ invoices, timezone }: UnpaidModalContentProps) {
  const today = todayString(timezone);

  return (
    <React.Fragment>
      <Modal.CloseTrigger />
      <Modal.Header className="border-b border-separator px-5 py-4">
        <Modal.Heading className="text-base font-semibold">
          미납
          {' '}
          <span className="text-danger">
            {invoices.length}
            건
          </span>
        </Modal.Heading>
      </Modal.Header>
      <Modal.Body className="flex-1 overflow-y-auto p-0">
        {/* 서버 정렬(오래된 순) 그대로. 줄은 읽기 전용 */}
        <ul>
          {invoices.map(invoice => (
            <li
              key={invoice.uuid}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-4 border-t border-separator px-5 py-3 first:border-t-0"
            >
              <span className="min-w-0 truncate">
                <b className="font-semibold">{invoice.student.name}</b>
                <small className="ml-2 text-xs text-muted">{invoicePeriodLabel(invoice)}</small>
              </span>
              <span className="font-semibold tabular-nums">{won(invoice.price)}</span>
              <small className="min-w-[66px] text-right text-xs text-muted tabular-nums">
                {elapsedLabel(invoice.periodStart, today)}
              </small>
            </li>
          ))}
        </ul>
      </Modal.Body>
      <Modal.Footer className="flex justify-between border-t border-separator px-5 py-3 text-[13px] text-muted">
        <span>오래된 순</span>
        <span>
          합계
          {' '}
          <b className="font-bold text-danger tabular-nums">{won(sumPrice(invoices))}</b>
        </span>
      </Modal.Footer>
    </React.Fragment>
  );
}
