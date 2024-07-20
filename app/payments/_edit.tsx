"use client";
import React from "react";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import PaymentForm from "@/components/forms/payment-form";

export default function Payments({payment}: any) {

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const onClose = React.useCallback(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("edit");

        params.toString();
        router.push(`${pathname}?${params.toString()}`);
    }, [pathname, router, searchParams]);

    if (!payment) {
        return null;
    }
    console.log('durl dksdhsl?')
    return (
        <PaymentForm
            syllabus={{
                ...payment.syllabus,
                payment: {
                    ...payment,
                },
            }}
            onSuccess={() => {
                onClose();
                router.refresh();
            }}
            onClose={onClose}
        />
    );
}
