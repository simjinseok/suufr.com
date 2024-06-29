"use client";
import { Input } from "@/components/input";
import { useSearchParams } from "next/navigation";
import { Select } from "@/components/select";

export default function ConditionForm() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "";
  return (
    <form method="get" className="flex">
      {/*<Input name="name" /> 검색 지원 예정*/}
      <Select
        name="status"
        defaultValue={status}
        onChange={(e) => (e.target.form as HTMLFormElement).submit()}
      >
        <option value="">전체</option>
        <option value="active">수강중</option>
        <option value="paused">중단</option>
        <option value="leave">그만둠</option>
      </Select>
    </form>
  );
}
