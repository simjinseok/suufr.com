import prisma from '@/utils/prisma';

export async function GET() {
  try {
    // DB 연결 확인
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  }
  catch (error) {
    return Response.json(
      {
        status: 'error',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
