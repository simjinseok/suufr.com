"use client";
import { format } from "date-fns/format";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/table";
import { Button } from "@/components/button";

export default function Lessons({ lessons }: any) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeader>일자</TableHeader>
          <TableHeader>학생명</TableHeader>
          <TableHeader>메모</TableHeader>
          <TableHeader>수정</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {lessons.map((lesson: any) => (
          <TableRow key={`lesson-${lesson.id}`}>
            <TableCell>{format(lesson.lessonAt, "yyyy-MM-dd HH:mm")}</TableCell>
            <TableCell>{lesson.student.name}</TableCell>
            <TableCell>{lesson.notes}</TableCell>
            <TableCell>
              <Button color="white">수정</Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
