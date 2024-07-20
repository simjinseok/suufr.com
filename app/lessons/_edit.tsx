"use client";
import React from "react";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import LessonForm from "@/components/forms/lesson-form";

export default function EditLesson({lesson}: any) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const onClose = React.useCallback(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("edit");

        params.toString();
        router.push(`${pathname}?${params.toString()}`);
    }, [pathname, router, searchParams]);

    if (!lesson) {
        return null;
    }

    return (
        <LessonForm
            lesson={lesson}
            onSuccess={() => {
                onClose();
                router.refresh();
            }}
            onClose={onClose}
        />
    );
}
