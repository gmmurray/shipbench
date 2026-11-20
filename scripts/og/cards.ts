// The content input to the OG generator: what each card says, and where its
// PNG lands. Editing copy here and re-running `pnpm generate:og` is the whole
// workflow — nothing about these strings is inferred at render time.
//
// Each card's `og:image:alt` lives with the app that serves it, not here, so
// there is one source of truth per string rather than a mirror to keep in sync.
// Changing a headline means updating the matching alt; the pointers are noted
// per card below.
import type { CardSpec } from './template.ts';

export interface Card extends CardSpec {
  /** Repo-relative output path for the 1200x630 PNG. */
  out: string;
}

export const CARDS: Card[] = [
  {
    // alt: SITE_CONFIG.socialImageAlt in apps/site/src/config/site.ts
    out: 'apps/site/public/opengraph.png',
    kicker: 'ShipBench / Project System',
    headline: 'Plans that ship with the work.',
    subhead: 'shipbench.dev',
  },
];
