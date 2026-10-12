---
title: Add Umami analytics to shipbench.dev
status: review
priority: medium
tags:
  - site
  - shipbench-dev
created: '2026-09-29T12:42:58.434Z'
updated: '2026-10-12T23:00:16.891Z'
---

Add Umami page-view analytics to shipbench.dev so the owner can see which pages get read and where visitors come from. Umami is cookieless and collects no personal data, so the site needs no consent banner.

## Before starting

The owner creates the site in Umami and supplies the website ID and script URL. Whether that is Umami Cloud or a self-hosted instance is an open question below. The ID is public by design, so it can live in `apps/site/src/config/site.ts` beside the other site constants.

## Behavior

- Every built page loads the Umami tracker from `BaseLayout.astro`: one `<script defer>` with `data-website-id`.
- Only production counts. Set `data-domains="shipbench.dev"` so `astro dev`, `astro preview`, the Playwright harness, and Cloudflare preview deployments never send a page view.
- Page views count on client-side navigation too. The site uses Astro's `ClientRouter`. Umami's tracker hooks `history.pushState`, but confirm in a browser that a navigation between docs pages records exactly one view: not zero, and not a second tracker instance after a swap.
- The tracker goes after the inline theme bootstrap in `<head>`. `built-output.spec.ts` already fails if an external script comes before it. First-paint theme correctness matters more than analytics.
- The site keeps working when the script is blocked (ad blockers, privacy extensions). Nothing on the page depends on it.

## Out of scope

- Harbor. It lives in its own repository.
- Custom events (for example, copying the install command). Pageviews first. Events can follow as a separate task once there is data to look at.
- A cookie or consent banner. Umami sets no cookies.
- A first-party proxy to get past ad blockers. See open questions.

## Acceptance

- The built `index.html` and a docs page carry the Umami script with the website ID, `defer`, and `data-domains="shipbench.dev"`. The theme bootstrap still precedes it. `built-output.spec.ts` asserts this.
- The e2e harness sends no requests to the Umami host. Block or assert on the route so a regression shows up.
- After deploy, the Umami dashboard shows views for the home page and a docs page reached through a client-side navigation.
- The axe baseline is unchanged.

## Open questions

- Umami Cloud (free tier, nothing to run) or self-hosted (needs a Postgres database, more work, full data ownership)?
- Should the tracker be served from a shipbench.dev path through a Cloudflare route, so blockers that target `cloud.umami.is` still count visits? That adds a moving part and can wait for real numbers.
- Does the site need a short privacy note saying what is collected? There is no privacy page today. Per AGENTS.md › Naming and branding, say only what the site actually does.

## Task Updates

### 2026-10-05T15:25:10.410Z
umami cloud (paid plan). script (from umami): `<script defer src="https://cloud.umami.is/script.js" data-website-id="ce714e4f-ac12-45cc-baab-ae4b6b2a3e10"></script>`. proxy probably not needed for now. privacy note still undecided.

### 2026-10-12T23:00:16.804Z
Implemented with Umami Cloud, no proxy, no privacy note (still undecided, left for a follow-up).

Browser check before deploy, using the real `cloud.umami.is/script.js` with the page's `data-domains` rewritten to `localhost` and `/api/send` stubbed: one view on first load, exactly one more on a ClientRouter navigation, one script fetch, one tag after the swap. With `data-domains="shipbench.dev"` left as built, nothing is sent from localhost.

Two findings from that check:

- The tracker reports to `gateway.umami.is`, not `cloud.umami.is`. The harness block covers `*.umami.is` for this reason.
- Back/forward navigation records no view. Umami hooks `pushState`/`replaceState` only, and ClientRouter's back/forward goes through `popstate`. That is Umami's standard behavior, so it is left as is. Changing it would mean tracking manually on `astro:page-load`, which risks double counts.

Still to do after deploy: confirm the dashboard shows the home page and a docs page reached by a client-side navigation.
