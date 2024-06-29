import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";
import { format } from "date-fns/format";
import { formatToKoreanNumber } from "@toss/utils";

import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Payments from "./_payments";

export default async function Page({
  searchParams,
}: { searchParams: { date: string } }) {
  const date = new Date(searchParams.date || Date.now());

  const prisma = new PrismaClient();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const payments = await prisma.payment.findMany({
    include: {
      syllabus: {
        include: {
          student: true,
        },
      },
    },
    where: {
      deletedAt: null,
      paidAt: {
        gt: new Date(date.getFullYear(), date.getMonth(), 1),
        lt: new Date(date.getFullYear(), date.getMonth() + 1, 1),
      },
      syllabus: {
        student: {
          userId: user.id,
        },
      },
    },
    orderBy: {
      paidAt: "desc",
    },
  });

  return (
    <div>
      <div className="flex items-center justify-center gap-3">
        <Link
          href={{
            query: {
              date: format(
                new Date(date.getFullYear(), date.getMonth() - 1),
                "yyyy-MM",
              ),
            },
          }}
        >
          <ChevronLeftIcon width={20} height={20} strokeWidth={1.5} />
        </Link>
        <p className="text-lg font-bold">{format(date, "yyyy-MM")}</p>
        <Link
          href={{
            query: {
              date: format(
                new Date(date.getFullYear(), date.getMonth() + 1),
                "yyyy-MM",
              ),
            },
          }}
        >
          <ChevronRightIcon width={20} height={20} strokeWidth={1.5} />
        </Link>
      </div>
      <p>{payments.length}건 총 {formatToKoreanNumber(payments.reduce((t, p) => t + p.amount, 0))}원</p>
      {payments.length > 0 ? (
        <Payments payments={payments} />
      ) : (
        <div>입금 내역이 없어요</div>
      )}
    </div>
  );
}
