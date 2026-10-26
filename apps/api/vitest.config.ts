import { defineConfig } from 'vitest/config';
import path from 'path';

// NestJS 데코레이터는 tsconfig 의 experimentalDecorators·emitDecoratorMetadata 로 처리된다.
// vite 8 은 design:type 메타데이터를 만들므로 class-transformer 의 implicit conversion 이 운영(nest build)과 같게 동작한다.
// Nest DI 컨테이너를 띄우는 테스트는 두지 않는다 (서비스는 생성자에 mock 을 직접 주입).
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
