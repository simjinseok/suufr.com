import type { NextApiRequest } from "next";

import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";

export async function GET(
    request: Request,
) {

    const { searchParams } = new URL(request.url)
    const studentId = Number(searchParams.get('studentId'));

    const prisma = new PrismaClient();
    const supabase = createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return new Response("", {
            status: 401,
        });
    }

    const student = await prisma.student.findUnique({
        where: {
            id: studentId,
            userId: user.id,
            deletedAt: null,
        }
    });

    if (!student) {
        return new Response("", {
            status: 404,
        });
    }

    const lessons = await prisma.lesson.findMany({
        where: {
            studentId: student.id,
            deletedAt: null,
        },
        orderBy: [{
            lessonAt: 'desc'
        }]
    });

    return Response.json(lessons, { status: 200 });
}
