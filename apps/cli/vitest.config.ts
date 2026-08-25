import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'shipbench-cli',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
