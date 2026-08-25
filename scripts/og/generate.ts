// Regenerates every OpenGraph card from {brand mark, template, copy}.
//
//   pnpm generate:og
//
// Deliberately not part of `astro build`: these change a few times a year, and
// wiring them into the build would make a Chromium download a hard prerequisite
// for building the site. The PNGs stay committed; run this when the mark, the
// template, or the copy in cards.ts changes.
//
// Needs a Chromium: `pnpm --filter @shipbench/site exec playwright install chromium`.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { CARDS } from './cards.ts';
import {
  buildCardHtml,
  CARD_HEIGHT,
  CARD_WIDTH,
  type FontFace,
} from './template.ts';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MARK = join(REPO_ROOT, 'docs/brand/logo-mark.svg');

// Only the weights the template actually asks for. Subsetting to `latin` keeps
// the embedded base64 small; the cards are English-only by construction.
const FONTS: { pkg: string; family: string; weight: number }[] = [
  { pkg: '@fontsource/ibm-plex-sans', family: 'IBM Plex Sans', weight: 600 },
  { pkg: '@fontsource/intel-one-mono', family: 'Intel One Mono', weight: 400 },
  { pkg: '@fontsource/intel-one-mono', family: 'Intel One Mono', weight: 500 },
];

// Fonts resolve from the site's dependency tree rather than the root's, so the
// cards are always drawn with the exact font files shipbench.dev ships.
const requireFromSite = createRequire(
  join(REPO_ROOT, 'apps/site/package.json'),
);

async function loadFonts(): Promise<FontFace[]> {
  return Promise.all(
    FONTS.map(async ({ pkg, family, weight }) => {
      const slug = pkg.replace('@fontsource/', '');
      const file = requireFromSite.resolve(
        `${pkg}/files/${slug}-latin-${weight}-normal.woff2`,
      );
      return {
        family,
        weight,
        data: (await readFile(file)).toString('base64'),
      };
    }),
  );
}

async function main(): Promise<void> {
  const markDataUri = `data:image/svg+xml;base64,${(await readFile(MARK)).toString('base64')}`;
  const fonts = await loadFonts();

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: CARD_WIDTH, height: CARD_HEIGHT },
      deviceScaleFactor: 1,
    });

    for (const card of CARDS) {
      await page.setContent(buildCardHtml(card, markDataUri, fonts), {
        waitUntil: 'load',
      });
      // The faces are `font-display: block` and inlined, so this resolves as
      // soon as they are parsed — but without it the first card can rasterize
      // mid-swap and ship a fallback-font headline.
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: join(REPO_ROOT, card.out) });
      console.log(`wrote ${card.out}`);
    }
  } finally {
    await browser.close();
  }
}

await main();
