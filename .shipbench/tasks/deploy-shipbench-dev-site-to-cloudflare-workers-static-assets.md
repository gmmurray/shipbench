---
title: Deploy shipbench.dev site to Cloudflare Workers static assets
status: backlog
priority: medium
tags:
  - shipbench-dev
  - site
  - deploy
created: '2026-08-22T20:35:23.421Z'
updated: '2026-08-22T20:35:23.421Z'
---

Deploy the `apps/site` Astro application to Cloudflare Workers static assets at the `shipbench.dev` apex domain.

The site and its docs are built and passing; `apps/site/wrangler.jsonc` already exists. What is missing is the deploy itself and the domain wiring.

## Requirements

1. Finish configuring `apps/site/wrangler.jsonc` for Cloudflare Workers static asset hosting.
2. Set up domain routing for the `shipbench.dev` apex (and an optional `www.shipbench.dev` redirect).
3. Verify the landing page and public documentation routes (`/docs/*`) load cleanly over SSL.
4. Verify asset caching and fast global edge response.
5. Confirm Pagefind search works against the deployed build, not just the local one — the index is produced by `astro build && pagefind --site dist/client` and has to ship with the assets.

## Definition of Done

- `apps/site` deploys cleanly via `wrangler deploy` to Cloudflare Workers.
- `https://shipbench.dev` renders the live site and `/docs/*` pages.
- Search returns results on the deployed site.
