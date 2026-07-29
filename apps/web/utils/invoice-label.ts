import { format } from 'date-fns/format';
import { ko } from 'date-fns/locale/ko';
import { tz } from '@date-fns/tz';
import { numberToHangulMixed } from 'es-hangul';

// 수강권을 한 줄로 가리키는 라벨 — 입금 모달의 연결 Select와 대시보드 미납 목록이 공유한다.
type InvoiceLike = {
  title: string | null;
  price: number;
  periodStart: string | null;
  periodEnd: string | null;
};

// 기간 표기 — date-only는 UTC 고정 (suufr 타임존 규칙)
export function invoicePeriodLabel(invoice: Pick<InvoiceLike, 'periodStart' | 'periodEnd'>) {
  if (!invoice.periodStart) return null;

  const start = format(new Date(invoice.periodStart), 'M월 d일', { locale: ko, in: tz('UTC') });
  const end = invoice.periodEnd
    ? format(new Date(invoice.periodEnd), 'M월 d일', { locale: ko, in: tz('UTC') })
    : '';

  return `${start}~${end}`;
}

// 접근성/타이프어헤드용 전체 라벨
export function invoiceOptionLabel(invoice: InvoiceLike) {
  const title = invoice.title || '수강권';
  const price = invoice.price > 0 ? `${numberToHangulMixed(invoice.price)}원` : null;

  return [invoicePeriodLabel(invoice), title, price].filter(Boolean).join(' · ');
}
