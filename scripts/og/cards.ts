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
    // AGENTS.md › Naming and branding: the social image is a place a human
    // reads a statement, so it carries the *tagline*. The descriptor
    // ("Git-native project management for solo developers") is deliberately
    // absent — it is already this page's `og:title`, and the two are not
    // allowed to sit next to each other restating one claim twice. The subhead
    // carries the domain instead: useful on a card that gets screenshotted,
    // and it repeats nothing else in the card or its meta.
    //
    // alt: SITE_CONFIG.socialImageAlt in apps/site/src/config/site.ts
    out: 'apps/site/public/opengraph.png',
    kicker: 'ShipBench / Project System',
    headline: 'Plans that ship with the work.',
    subhead: 'shipbench.dev',
  },
];
