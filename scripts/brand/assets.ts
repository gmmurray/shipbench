// The standalone brand outputs derived from docs/brand/logo-mark.svg.
// Paths stay repo-relative so this file is the complete, reviewable inventory
// of what `pnpm generate:icons` writes.

export interface RasterAsset {
  /** Square output size in CSS/device pixels. */
  size: number;
  /** Repo-relative destinations that receive the same deterministic PNG. */
  out: string[];
}

export const STANDALONE_SVG_OUTPUTS = ['apps/site/public/logo.svg'] as const;

export const RASTER_ASSETS: RasterAsset[] = [
  {
    size: 32,
    out: ['apps/site/public/favicon.png'],
  },
  {
    size: 180,
    out: ['apps/site/public/apple-touch-icon.png'],
  },
  {
    size: 192,
    out: ['apps/site/public/android-chrome-192x192.png'],
  },
  {
    size: 512,
    out: ['apps/site/public/android-chrome-512x512.png'],
  },
];
