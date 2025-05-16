'use client';
import { format } from 'date-fns/format';
import { formatToKoreanNumber } from '@toss/utils';

import React from 'react';

import {
  Button,
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
} from '@heroui/react';
import PaymentModal from '@/components/payment-modal';

export default function Payments({ syllabuses }) {
  const [editingSyllabus, setEditingSyllabus] = React.useState(null);

  return (
    <React.Fragment>
      <Table className="mt-5" aria-label="입금내역">
        <TableHeader>
          <TableColumn>일자</TableColumn>
          <TableColumn>결제수단</TableColumn>
          <TableColumn>금액</TableColumn>
          <TableColumn>수강생</TableColumn>
          <TableColumn>메모</TableColumn>
          <TableColumn>수정</TableColumn>
        </TableHeader>
        <TableBody>
          {syllabuses.length > 0
            ? (
                <>
                  {syllabuses.map((syllabus: any) => (
                    <TableRow key={`syllabus-${syllabus.id}`}>
                      <TableCell className="tablur-nums">
                        {format(syllabus.payment.paidAt, 'yyyy-MM-dd')}
                      </TableCell>
                      <TableCell>{syllabus.payment.paymentMethod}</TableCell>
                      <TableCell className="tablur-nums text-right">
                        {formatToKoreanNumber(syllabus.payment.amount)}
                        원
                      </TableCell>
                      <TableCell>{syllabus.student.name}</TableCell>
                      <TableCell>{syllabus.payment.notes}</TableCell>
                      <TableCell>
                        <Button
                          variant="light"
                          onPress={() => setEditingSyllabus(syllabus)}
                        >
                          수정
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )
            : (
                <TableRow>
                  <TableCell className="text-center" colSpan={6}>
                    입금 내역이 없어요
                  </TableCell>
                </TableRow>
              )}
        </TableBody>
      </Table>
      <PaymentModal
        isOpen={editingSyllabus !== null}
        syllabus={editingSyllabus}
        onClose={() => { setEditingSyllabus(null); }}
      />
    </React.Fragment>
  );
}
