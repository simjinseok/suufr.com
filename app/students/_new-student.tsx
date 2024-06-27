"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import StudentForm from "@/components/student-form";

export default function NewStudentModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <Button
        color="emerald"
        onClick={setIsOpen.bind(null, true)}
        disabled={isOpen}
      >
        수강생 등록
      </Button>
      <StudentForm
        isOpen={isOpen}
        onSuccess={() => {
          setIsOpen(false);
          router.refresh();
        }}
        onClose={setIsOpen.bind(null, false)}
      />
    </>
  );
}
