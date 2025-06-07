"use client";
import type { TMeeting } from "@/types/index";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import MeetingForm from "@/components/forms/meeting-form";

export default function Edit({ meeting }: { meeting: TMeeting }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onClose = React.useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("edit");

    params.toString();
    router.push(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  if (!meeting) {
    return null;
  }

  return (
    <MeetingForm
      meeting={meeting}
      onSuccess={() => {
        onClose();
        router.refresh();
      }}
      onClose={onClose}
    />
  );
}
