import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";
import { redirect } from "next/navigation";
import Payments from "./_payments";

export default async function Page() {
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
      student: true
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

  console.log(payments);
  return (
    <div>
      {Array.isArray(payments) && payments.length > 0 ? (
        <Payments payments={payments} />
      ) : (
        <div>입금 내역이 없어요</div>
      )}
    </div>
  );
}
