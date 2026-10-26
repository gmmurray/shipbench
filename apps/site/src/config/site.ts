declare const __SHIPBENCH_VERSION__: string;

export const SITE_CONFIG = {
  name: 'ShipBench',
  version: __SHIPBENCH_VERSION__,
  // See AGENTS.md › Naming and branding for what goes in each of these.
  title: 'ShipBench — Git-native project management for solo developers',
  descriptor: 'Git-native project management for solo developers.',
  // Search results cut snippets at about 155 characters.
  description:
    'Keep each task as a Markdown file in the repository it belongs to, with a CLI and a local board on top. One command to set up, no account.',
  url: 'https://shipbench.dev',
  githubUrl: 'https://github.com/gmmurray/shipbench',
  npmUrl: 'https://www.npmjs.com/package/shipbench',
  author: { name: 'Greg', url: 'https://thedevelopergreg.com' },
  socialImage: '/opengraph.png',
  // Must describe public/opengraph.png, generated from scripts/og/cards.ts.
  // Change the headline there and update this too.
  socialImageAlt: 'ShipBench — Plans that ship with the work. shipbench.dev',
  // Umami Cloud. The website ID is public by design: it ships in every page.
  // `domains` keeps dev, preview, the e2e harness, and Cloudflare preview
  // deployments from recording views — the tracker only reports on these hosts.
  analytics: {
    scriptUrl: 'https://cloud.umami.is/script.js',
    websiteId: 'ce714e4f-ac12-45cc-baab-ae4b6b2a3e10',
    domains: 'shipbench.dev',
  },
} as const;
