// Regenerates the baked logo and platform icon set from the canonical vector
// mark. Outputs stay committed and this remains opt-in, like scripts/og/:
//
//   pnpm generate:icons
//
// Needs a Chromium: `pnpm --filter @shipbench/site exec playwright install chromium`.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { RASTER_ASSETS, STANDALONE_SVG_OUTPUTS } from './assets.ts';
import { buildIconHtml, buildStandaloneLogoSvg } from './template.ts';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MARK = join(REPO_ROOT, 'docs/brand/logo-mark.svg');

async function main(): Promise<void> {
  const mark = await readFile(MARK, 'utf8');
  const standaloneSvg = buildStandaloneLogoSvg(mark);

  for (const out of STANDALONE_SVG_OUTPUTS) {
    await writeFile(join(REPO_ROOT, out), standaloneSvg);
    console.log(`wrote ${out}`);
  }

  const sizes = [...new Set(RASTER_ASSETS.map(asset => asset.size))].sort(
    (left, right) => left - right,
  );
  const pngBySize = new Map<number, Buffer>();
  const svgDataUri = `data:image/svg+xml;base64,${Buffer.from(standaloneSvg).toString('base64')}`;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: sizes[0], height: sizes[0] },
      deviceScaleFactor: 1,
    });

    for (const size of sizes) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(buildIconHtml(svgDataUri, size), {
        waitUntil: 'load',
      });
      await page
        .locator('img')
        .evaluate(image => (image as HTMLImageElement).decode());
      pngBySize.set(size, await page.screenshot({ type: 'png' }));
    }
  } finally {
    await browser.close();
  }

  for (const asset of RASTER_ASSETS) {
    const png = requiredPng(pngBySize, asset.size);
    for (const out of asset.out) {
      await writeFile(join(REPO_ROOT, out), png);
      console.log(`wrote ${out}`);
    }
  }
}

function requiredPng(pngBySize: Map<number, Buffer>, size: number): Buffer {
  const png = pngBySize.get(size);
  if (!png) throw new Error(`No rendered PNG for ${size}px`);
  return png;
}

await main();
