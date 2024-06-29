"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import StudentForm from "@/components/forms/student-form";

export default function EditStudentButton({ student }: any) {
  const router = useRouter();
  const [isEditing, setIsEditing] = React.useState(false);

  return (
    <div>
      <Button onClick={setIsEditing.bind(null, true)}>수정</Button>
      {isEditing && (
        <StudentForm
          isOpen={isEditing}
          student={student}
          onSuccess={() => {
            router.refresh();
            alert("수정이 완료되었습니다");
            setIsEditing(false);
          }}
          onClose={setIsEditing.bind(null, false)}
        />
      )}
    </div>
  );
}
