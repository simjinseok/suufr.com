import { defineConfig } from 'vitest/config';
import path from 'path';

// NestJS 데코레이터는 tsconfig 의 experimentalDecorators 로 처리된다.
// esbuild 는 emitDecoratorMetadata 를 지원하지 않으므로 Nest DI 컨테이너를 띄우는 테스트는 두지 않는다
// (서비스는 생성자에 mock 을 직접 주입). class-validator / class-transformer 는 메타데이터 없이 동작한다.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['./src/test-setup.ts'],
  },
  resolve: {
    alias: {
      '@prisma/generated': path.resolve(__dirname, './src/generated/prisma'),
    },
  },
});
