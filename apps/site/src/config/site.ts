declare const __SHIPBENCH_VERSION__: string;

export const SITE_CONFIG = {
  name: 'ShipBench',
  version: __SHIPBENCH_VERSION__,
  title: 'ShipBench — Git-Native Project Management for Solo Developers',
  // Tagline vs. descriptor (AGENTS.md › Naming and branding): `title` carries
  // the descriptor because its job is search and categorization. The
  // description gets to carry the reason, which is what earns the click.
  description:
    'Setting up a tracker for every new project costs more than it saves, so most projects never get one. ShipBench keeps tasks as Markdown in your Git repository.',
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
