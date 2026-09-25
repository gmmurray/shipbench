import { HARBOR_ENABLED } from './flags';

declare const __SHIPBENCH_VERSION__: string;

export const SITE_CONFIG = {
  name: 'ShipBench',
  version: __SHIPBENCH_VERSION__,
  // See AGENTS.md › Naming and branding for what goes in each of these.
  title: 'ShipBench — Git-native project management for solo developers',
  // Search results cut snippets at about 155 characters.
  description:
    'Keep each task as a Markdown file in the repository it belongs to, with a CLI and a local board on top. One command to set up, no account.',
  url: 'https://shipbench.dev',
  harborEnabled: HARBOR_ENABLED,
  harborUrl: 'https://harbor.shipbench.dev',
  githubUrl: 'https://github.com/gmmurray/shipbench',
  npmUrl: 'https://www.npmjs.com/package/shipbench',
  author: { name: 'Greg', url: 'https://thedevelopergreg.com' },
  socialImage: '/opengraph.png',
  // Must describe public/opengraph.png, generated from scripts/og/cards.ts.
  // Change the headline there and update this too.
  socialImageAlt: 'ShipBench — Plans that ship with the work. shipbench.dev',
} as const;
