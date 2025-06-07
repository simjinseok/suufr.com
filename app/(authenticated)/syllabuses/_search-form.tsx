'use client';
import * as React from 'react';
import { Button } from '@heroui/react';
import StudentsModal from "@/components/students-modal";

export default function SearchForm() {
  const [openStudents, setOpenStudents] = React.useState(false);
  return (
    <React.Fragment>
      <form>
        <Button onClick={() => setOpenStudents(true)}>수강생</Button>
      </form>
      <StudentsModal isOpen={openStudents} onClose={() => setOpenStudents(false)} />
    </React.Fragment>
  );
}
