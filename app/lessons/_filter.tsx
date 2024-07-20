'use client';
import React from "react";
import {Field, Label} from "@/components/fieldset";
import {Input} from "@/components/input";
import {useSearchParams} from "next/navigation";


export default function Filter() {
    const searchParams = useSearchParams();
    const formId = React.useId();

    console.log(searchParams)
    return (
        <form id={formId} method="GET" onInput={(event) => {
            (event.target as HTMLInputElement).form!.submit();
        }} className="flex justify-end gap-3">
            <Field>
                <Label>시작날짜</Label>
                <Input type="date" name="from" defaultValue={searchParams.get("from") || ''}/>
            </Field>
            <Field>
                <Label>종료날짜</Label>
                <Input type="date" name="to" defaultValue={searchParams.get("to") || ''}/>
            </Field>
        </form>
    )
}
