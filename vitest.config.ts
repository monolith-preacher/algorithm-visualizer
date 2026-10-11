import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/server/test/**/*.test.ts', 'apps/web/src/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
