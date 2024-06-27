import Link from "next/link";
import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";

import { redirect } from "next/navigation";
import { Button } from "@/components/button";
import NewStudent from "./_new-student";
import { Heading } from "@/components/heading";

export default async function Page() {
  const prisma = new PrismaClient();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const students = await prisma.student.findMany({
    where: {
      deletedAt: null,
      userId: user.id,
    },
  });

  return (
    <div className="mt-3">
      <div className="flex w-full flex-wrap items-end justify-between gap-4 border-b border-zinc-950/10 pb-6 dark:border-white/10">
        <Heading className="text-2xl font-bold">수강생 목록</Heading>
        <NewStudent />
      </div>
      <ul className="mt-3 divide-y">
        {students.map((student) => (
          <li
            key={`student-${student.id}`}
            className="flex justify-between py-5"
          >
            <div>
              <p className="text-xl font-bold">{student.name}</p>
            </div>
            <div className="flex items-center">
              <Link
                href={{
                  pathname: `/students/${student.id}`,
                }}
              >
                <Button color="zinc">상세보기</Button>
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
