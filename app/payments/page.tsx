import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";
import { redirect } from "next/navigation";
import Payments from "./_payments";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

const PAGE_SIZE = 20;
export default async function Page({ searchParams }: any) {
  const page = searchParams.page > 0 ? Number(searchParams.page) : 1;

  const prisma = new PrismaClient();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const payments = await prisma.payment.findMany({
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      student: true,
    },
    where: {
      deletedAt: null,
      student: {
        userId: user.id,
      },
    },
    orderBy: {
      paidAt: "desc",
    },
  });
  const paymentsCount = await prisma.payment.count({
    where: {
      deletedAt: null,
      student: {
        userId: user.id,
      },
    },
  });

  return (
    <div>
      {Array.isArray(payments) && payments.length > 0 ? (
        <>
          <Payments payments={payments} />
          <div className="mt-5 flex justify-between">
            {page > 1 && (
              <Link
                className="flex items-center"
                href={{
                  query: {
                    page: page - 1,
                  },
                }}
              >
                <ChevronLeftIcon />
                이전 페이지
              </Link>
            )}
            {paymentsCount > page * PAGE_SIZE && (
              <Link
                className="flex items-center"
                href={{
                  query: {
                    page: page + 1,
                  },
                }}
              >
                다음 페이지
                <ChevronRightIcon />
              </Link>
            )}
          </div>
        </>
      ) : (
        <div>입금 내역이 없어요</div>
      )}
    </div>
  );
}
