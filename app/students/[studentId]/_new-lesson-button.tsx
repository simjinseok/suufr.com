"use client";
import React from "react";
import { Button } from "@/components/button";
import dynamic from "next/dynamic";
import NewLessonDialog from "./_new-lesson-dialog";

const EditStudentDialog = dynamic(() => import("./_edit-dialog"));
export default function NewLessonButton({ student }) {
  const [openEdit, setOpenEdit] = React.useState(false);


  return (
    <>
      <div className="flex gap-3">
        <Button color="zinc" onClick={setOpenEdit.bind(null, true)}>정보 수정</Button>

      </div>
      {openEdit && (
          <EditStudentDialog student={student} onClose={setOpenEdit.bind(null, false)} />
      )}
    </>
  );
}
