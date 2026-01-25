'use client';

import { Button, Chip, Modal, Surface } from '@heroui/react';
import { format } from 'date-fns';
import { numberToHangulMixed } from 'es-hangul';
import { ko } from 'date-fns/locale/ko';
import PaymentModal from '@/components/lesson/payment-modal';
import { modal } from '@/contexts/modal-manager';

type Lesson = {
  id: number;
  title: string;
  createdAt: Date;
  payment: {
    id: number;
    amount: number;
    paymentMethod: string;
    paidAt: Date;
    notes: string | null;
  } | null;
};

type Props = {
  lessons: Lesson[];
};

const PAYMENT_METHODS: Record<string, string> = {
  card: '카드',
  transfer: '계좌이체',
  cash: '현금',
  none: '미지정',
};

export default function PaymentsTable({ lessons }: Props) {

  if (lessons.length === 0) {
    return (
      <div className="py-12 text-center text-zinc-500">
        등록된 레슨이 없습니다
      </div>
    );
  }

  const paidLessons = lessons.filter(s => s.payment !== null);
  const unpaidLessons = lessons.filter(s => s.payment === null);
  const totalAmount = paidLessons.reduce(
    (sum, s) => sum + (s.payment?.amount ?? 0),
    0,
  );

  return (
    <div className="space-y-4">
      <Surface variant="secondary" className="rounded-2xl p-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-primary-600">총 결제액</span>
          <span className="text-lg md:text-xl font-bold text-primary-900 tabular-nums">
            {numberToHangulMixed(totalAmount)}
            원
          </span>
        </div>
        <p className="mt-1 text-xs text-primary-600">
          결제
          {' '}
          {paidLessons.length}
          건
          {unpaidLessons.length > 0 && (
            <span className="text-warning-600 font-medium">
              {' '}
              · 미결제
              {' '}
              {unpaidLessons.length}
              건
            </span>
          )}
        </p>
      </Surface>

      <div className="bg-white rounded-2xl overflow-hidden">
        {lessons.map((lesson, index) => (
          <div
            key={lesson.id}
            className={`
            p-4
            ${index !== lessons.length - 1 ? 'border-b border-zinc-100' : ''}
            ${!lesson.payment ? 'bg-warning-50' : ''}
          `}
          >
            <div className="flex justify-between items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-zinc-900">
                  {lesson.title}
                </p>
                {lesson.payment
                  ? (
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {format(new Date(lesson.payment.paidAt), 'M월 d일', { locale: ko })}
                  &nbsp;·&nbsp;
                        {PAYMENT_METHODS[lesson.payment.paymentMethod]}
                      </p>
                    )
                  : (
                      <Chip size="sm" color="warning" variant="soft" className="mt-0.5">
                        결제 대기중
                      </Chip>
                    )}
              </div>
              <div className="shrink-0">
                {lesson.payment
                  ? (
                      <div className="flex flex-col items-end">
                        <Chip
                          size="sm"
                          variant="tertiary"
                          color="accent"
                          onClick={() => {
                            modal.show(PaymentModal, { lesson });
                          }}
                        >
                          수정
                        </Chip>
                        <p className="text-base font-bold text-zinc-900 tabular-nums">
                          {numberToHangulMixed(lesson.payment.amount)}
                          원
                        </p>
                      </div>
                    )
                  : (
                      <Modal>
                        <Button
                          size="sm"
                          variant="danger-soft"
                        >
                          결제 등록
                        </Button>
                        <PaymentModal lesson={lesson} />
                      </Modal>
                    )}
              </div>
            </div>

            {/* 메모 (있는 경우만) */}
            {lesson.payment?.notes && (
              <div className={`
              mt-3 p-3 rounded-lg text-sm text-zinc-600 leading-relaxed whitespace-pre-line
              ${lesson.payment ? 'bg-zinc-50' : 'bg-warning-100'}
            `}
              >
                {lesson.payment.notes}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
