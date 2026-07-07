import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@/actions': path.resolve(__dirname, './actions'),
      '@/components': path.resolve(__dirname, './components'),
      '@/contexts': path.resolve(__dirname, './contexts'),
      '@/schemas': path.resolve(__dirname, './schemas'),
      '@/types': path.resolve(__dirname, './types'),
      '@/utils': path.resolve(__dirname, './utils'),
    },
  },
});
