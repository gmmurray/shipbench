// @ts-check

import { readFileSync } from 'node:fs';
import cloudflare from '@astrojs/cloudflare';
import { satteri } from '@astrojs/markdown-satteri';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import { defineConfig, fontProviders } from 'astro/config';
import copyMeta from './src/utils/shiki-copy-meta.mjs';
import tableRegions from './src/utils/satteri-table-regions.mjs';

// The CLI is the namesake ShipBench artifact. Core, CLI, and Board release in
// lockstep, so its manifest is the source of truth for the displayed version.
const shipbenchVersion = /** @type {{ version: string }} */ (
  JSON.parse(
    readFileSync(new URL('../cli/package.json', import.meta.url), 'utf8'),
  )
).version;

// Server deps the Cloudflare adapter's pre-bundle list misses, so Vite finds
// them only when the dev worker first loads. Each late find re-optimizes
// deps_ssr and renames its shared chunks under an in-flight reload, which then
// fails with "The file does not exist ... in the optimize deps directory".
// Listing them here makes the cold-start pass complete. `astro/logger/json`
// loads only when `astro dev` runs in the background (any non-TTY start). If
// that error returns, the `dependency optimized: <id>` line just above it names
// the entry to add.
const ssrLateDeps = [
  'astro/app/manifest',
  'astro/logger/json',
  '@astrojs/svelte/server.js',
];

// https://astro.build/config
export default defineConfig({
  site: 'https://shipbench.dev',
  output: 'static',
  adapter: cloudflare(),

  vite: {
    define: {
      __SHIPBENCH_VERSION__: JSON.stringify(shipbenchVersion),
    },
    // Only the ssr environment: the top-level `optimizeDeps` the adapter also
    // reads would make the client environment bundle the server renderer.
    ssr: {
      optimizeDeps: {
        include: ssrLateDeps,
      },
    },
  },

  // The build format is `directory`, so every route's real URL carries a
  // trailing slash and a bare path costs a 307 before the 200. Point this at
  // the canonical form so /docs is one hop, not two, and author internal links
  // the same way — src/test/internal-links.test.ts holds that line.
  redirects: {
    '/docs': '/docs/overview/',
  },

  markdown: {
    processor: satteri({ hastPlugins: [tableRegions] }),
    // Dual themes make Shiki emit a CSS custom property per token instead of a
    // single baked color. `defaultColor: 'dark'` puts dark in the inline style
    // and light behind `--shiki-light`, keeping dark — the signature theme —
    // correct even before any of our CSS applies. See styles/code-blocks.css.
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: 'dark',
      // Reads a fence's `no-copy` marker onto the <pre>. Satteri passes meta
      // through to codeToHast, so this is the whole mechanism — see
      // src/utils/shiki-copy-meta.mjs.
      transformers: [copyMeta],
    },
  },

  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'IBM Plex Sans',
      cssVariable: '--font-plex-sans',
      weights: [400, 500, 600, 700],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Intel One Mono',
      cssVariable: '--font-intel-mono',
      weights: [400, 500, 700],
    },
  ],

  integrations: [sitemap(), svelte()],
});
