'use client';
import type { ModalProps } from '@heroui/react';

import * as React from 'react';
import {
  Button,
  Description,
  Form,
  Label,
  ListBox,
  Modal,
  NumberField,
  Select,
} from '@heroui/react';
import { numberToHangulMixed } from 'es-hangul';
import { format } from 'date-fns/format';
import { ko } from 'date-fns/locale/ko';
import { tz } from '@date-fns/tz';
import { useTimeZone } from '@/contexts/timezone';
import { BanknoteIcon, CreditCardIcon, LandmarkIcon } from 'lucide-react';

import { settleSession } from '@/actions/invoice';

const METHOD_LABELS: Record<string, string> = {
  transfer: '계좌이체',
  card: '카드',
  cash: '현금',
};

// 회당 정산: 청구에 연결 안 된 수업 1개를 1회 수강권(totalCount=1) + 입금으로 한 번에 기록 (docs/schema-redesign.md §3)
interface Props {
  isOpen?: ModalProps['isOpen'];
  onOpenChange?: ModalProps['onOpenChange'];
  studentUuid: string;
  session: {
    uuid: string;
    sessionAt: Date | string;
  };
}
export default function SettleSessionModal({ isOpen, onOpenChange, studentUuid, session }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content studentUuid={studentUuid} session={session} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function Content({ close, studentUuid, session }: { studentUuid: string; session: Props['session']; close: () => void }) {
  const timeZone = useTimeZone();
  const formId = React.useId();
  const sessionDate = new Date(session.sessionAt);

  const [price, setPrice] = React.useState(0);
  const [method, setMethod] = React.useState('transfer');

  const [state, formAction, isPending] = React.useActionState(settleSession, {});

  React.useEffect(() => {
    if (!state.timestamp) return;

    if (state.success) {
      alert(state.message);
      close();
    }
  }, [state.success, state.timestamp, state.message]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>받은 금액 기록</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <p className="text-sm text-gray-600 mb-4">
          {format(sessionDate, 'M월 d일 (E) HH:mm', { locale: ko, in: tz(timeZone) })}
          {' '}
          수업의 수강료를 기록합니다.
        </p>
        <Form id={formId} className="p-1 flex flex-col gap-4" action={formAction}>
          <input type="hidden" name="studentUuid" value={studentUuid} />
          <input type="hidden" name="sessionUuid" value={session.uuid} />
          {/* 정산 날짜/제목은 화면에 보이는 날짜와 같은 타임존 기준이어야 한다 */}
          <input type="hidden" name="sessionDate" value={format(sessionDate, 'yyyy-MM-dd', { in: tz(timeZone) })} />
          <input type="hidden" name="title" value={format(sessionDate, 'M월 d일 수업', { locale: ko, in: tz(timeZone) })} />
          <input type="hidden" name="method" value={method} />

          <NumberField
            variant="secondary"
            value={price}
            minValue={0}
            onInput={(event) => {
              setPrice(Number(event.currentTarget.value.replaceAll(',', '')) || 0);
            }}
          >
            <Label>받은 금액</Label>
            <NumberField.Group>
              <NumberField.Input className="col-span-full text-right" />
            </NumberField.Group>
            <Description className="text-right">
              {numberToHangulMixed(price)}
              원
            </Description>
          </NumberField>
          <input type="hidden" name="price" value={price} />

          <Select
            variant="secondary"
            aria-label="결제수단"
            selectedKey={method}
            onSelectionChange={key => key != null && setMethod(String(key))}
          >
            <Label>결제수단</Label>
            <Select.Trigger>
              <span>{METHOD_LABELS[method]}</span>
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="transfer" textValue="계좌이체">
                  <LandmarkIcon />
                  <Label>계좌이체</Label>
                </ListBox.Item>
                <ListBox.Item id="card" textValue="카드">
                  <CreditCardIcon />
                  <Label>카드</Label>
                </ListBox.Item>
                <ListBox.Item id="cash" textValue="현금">
                  <BanknoteIcon />
                  <Label>현금</Label>
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" isDisabled={isPending} onClick={close}>닫기</Button>
        <Button form={formId} variant="primary" type="submit" isPending={isPending} isDisabled={price <= 0}>
          정산 기록
        </Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
