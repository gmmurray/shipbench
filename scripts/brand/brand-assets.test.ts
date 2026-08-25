import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RASTER_ASSETS, STANDALONE_SVG_OUTPUTS } from './assets.ts';
import { buildStandaloneLogoSvg } from './template.ts';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const atRoot = (path: string): string => join(REPO_ROOT, path);

describe('committed brand assets', () => {
  it('keeps every baked SVG generated from the canonical mark', () => {
    const mark = readFileSync(atRoot('docs/brand/logo-mark.svg'), 'utf8');
    const expected = Buffer.from(buildStandaloneLogoSvg(mark));

    for (const out of STANDALONE_SVG_OUTPUTS) {
      expect(readFileSync(atRoot(out)).equals(expected), out).toBe(true);
    }
  });

  it('keeps every raster alias byte-identical at its declared size', () => {
    for (const asset of RASTER_ASSETS) {
      const expected = readFileSync(atRoot(asset.out[0]));
      expect(pngDimensions(expected), asset.out[0]).toEqual({
        width: asset.size,
        height: asset.size,
      });

      for (const out of asset.out.slice(1)) {
        expect(readFileSync(atRoot(out)).equals(expected), out).toBe(true);
      }
    }
  });
});

function pngDimensions(png: Buffer): { width: number; height: number } {
  expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
  expect(png.toString('ascii', 12, 16)).toBe('IHDR');
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}
