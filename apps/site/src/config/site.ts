declare const __SHIPBENCH_VERSION__: string;

export const SITE_CONFIG = {
  name: 'ShipBench',
  version: __SHIPBENCH_VERSION__,
  // Tagline vs. descriptor (AGENTS.md › Naming and branding): `title` carries
  // the descriptor because its job is search and categorization, in the
  // descriptor's own sentence case — re-casing it would be a variant, and the
  // lowercase form also renders narrower, which this string needs at 61
  // characters. `description` carries the reason instead: it is the
  // search-result snippet, and the title beside it has already said the shelf.
  title: 'ShipBench — Git-native project management for solo developers',
  // States the problem as a mechanism, not a valuation, per the doctrine.
  // 147 characters — under the ~155 where snippets get cut mid-word.
  description:
    'Project trackers are built to coordinate people. ShipBench is built for one person with several repositories — tasks as Markdown, versioned in Git.',
  url: 'https://shipbench.dev',
  harborUrl: 'https://harbor.shipbench.dev',
  githubUrl: 'https://github.com/gmmurray/shipbench',
  npmUrl: 'https://www.npmjs.com/package/shipbench',
  socialImage: '/opengraph.png',
  // Describes what public/opengraph.png actually renders — keep the two in
  // step. The image is generated from scripts/og/cards.ts; change the headline
  // there and this line has to follow.
  socialImageAlt: 'ShipBench — Plans that ship with the work. shipbench.dev',
} as const;
