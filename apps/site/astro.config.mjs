// @ts-check

import { readFileSync } from 'node:fs';
import cloudflare from '@astrojs/cloudflare';
import { satteri } from '@astrojs/markdown-satteri';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import { defineConfig, fontProviders } from 'astro/config';
import tableRegions from './src/utils/satteri-table-regions.mjs';

// The CLI is the namesake ShipBench artifact. Core, CLI, and Board release in
// lockstep, so its manifest is the source of truth for the displayed version.
const shipbenchVersion = /** @type {{ version: string }} */ (
  JSON.parse(
    readFileSync(new URL('../cli/package.json', import.meta.url), 'utf8'),
  )
).version;

// https://astro.build/config
export default defineConfig({
  site: 'https://shipbench.dev',
  output: 'static',
  adapter: cloudflare(),

  vite: {
    define: {
      __SHIPBENCH_VERSION__: JSON.stringify(shipbenchVersion),
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
