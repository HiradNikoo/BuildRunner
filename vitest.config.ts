import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@main': path.resolve(__dirname, 'packages/main/src'),
      '@shared': path.resolve(__dirname, 'packages/shared/src'),
    },
  },
});
