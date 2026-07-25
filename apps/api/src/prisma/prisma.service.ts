import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // 커넥션 문자열만 넘겨 어댑터가 풀을 소유하게 한다(Prisma 표준 형태).
    // pg.Pool 인스턴스를 직접 만들어 넘기면 adapter-pg 가 자기 pg 사본으로
    // instanceof 검사를 하므로, 앱과 어댑터의 pg 버전이 갈리는 순간
    // Pool 이 설정 객체로 오인되어 연결 정보가 통째로 유실된다.
    const adapter = new PrismaPg({ connectionString: process.env.POSTGRES_PRISMA_URL });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  // 풀은 어댑터 소유이므로 $disconnect() 가 함께 정리한다.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
