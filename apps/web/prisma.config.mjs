import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',

  datasource: {
    // process.env 사용 - env() 헬퍼는 없으면 에러 발생
    // generate는 DB 연결 안 하므로 빈 문자열도 OK
    url: process.env.POSTGRES_PRISMA_URL ?? '',
  },
});
