import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/core',
      'packages/board',
      'apps/cli',
      // apps/site is deliberately absent. Its Svelte project needs the svelte
      // plugin and `resolve.conditions: ['browser']`, neither of which survives
      // being referenced from here — mount() throws
      // lifecycle_function_unavailable. It runs as its own CI step instead.
      {
        // Repo-level, because it is not any one package's: it checks the
        // doctrine's palette against both implementations of it in this repo
        // (site, Board). Pure arithmetic and a CSS parse — no browser, no DOM.
        test: {
          name: 'design-system',
          include: ['tests/design-system/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        // Generator contract: the committed platform icons must still match
        // the canonical vector mark and the declared inventory.
        // Pure file checks; Chromium is only needed when regenerating them.
        test: {
          name: 'brand-assets',
          include: ['scripts/brand/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
