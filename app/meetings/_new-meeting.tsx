"use client";
import React from "react";
import { Button } from "@/components/button";
import MeetingForm from "@/components/forms/meeting-form";
import { useRouter } from "next/navigation";

export default function NewMeeting() {
  const router = useRouter();
  const [isCreating, setIsCreating] = React.useState(false);

  return (
    <>
      <Button onClick={setIsCreating.bind(null, true)}>추가</Button>
      {isCreating && (
        <MeetingForm
          onSuccess={() => {
            router.refresh();
            alert("상담이 추가되었습니다");
            setIsCreating(false);
          }}
          onClose={setIsCreating.bind(null, false)}
        />
      )}
    </>
  );
}
