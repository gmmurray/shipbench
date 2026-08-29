---
title: Deploy shipbench.dev site to Cloudflare Workers static assets
status: done
priority: medium
tags:
  - shipbench-dev
  - site
  - deploy
created: '2026-08-22T20:35:23.421Z'
updated: '2026-08-29T18:45:45.923Z'
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

## Task Updates

### 2026-08-29T18:44:07.686Z
Completed by the owner 2026-08-29, deployed without issues. Side effect worth recording: the homepage field on all three npm packages points at https://shipbench.dev, so those registry links now resolve. They were deliberately live-but-dead between the 0.1.0 publish and this deploy.
