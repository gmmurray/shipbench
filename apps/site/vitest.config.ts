import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        // Pure logic. The search controller has no DOM dependency, and keeping
        // it in a node environment is what stops one leaking back in.
        test: {
          name: '@shipbench/site:node',
          include: ['src/scripts/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        // Svelte components. Mirrors packages/board/vitest.config.ts.
        plugins: [svelte()],
        // Without the browser condition, `svelte` resolves to its server entry
        // and mount() throws lifecycle_function_unavailable.
        resolve: { conditions: ['browser'] },
        test: {
          name: '@shipbench/site:components',
          include: ['src/components/**/*.test.ts'],
          environment: 'jsdom',
          setupFiles: ['src/test/setup.ts'],
        },
      },
    ],
  },
});
