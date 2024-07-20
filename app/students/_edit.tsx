"use client";
import React from "react";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import StudentForm from '@/components/forms/student-form';

export default function Payments({student}: any) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const onClose = React.useCallback(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("edit");

        params.toString();
        router.push(`${pathname}?${params.toString()}`);
    }, [pathname, router, searchParams]);

    if (!student) {
        return null;
    }

    return (
        <StudentForm
            isOpen
            onSuccess={() => {
                onClose();
                router.refresh();
            }}
            student={student}
            onClose={onClose}
        />
    );
}
