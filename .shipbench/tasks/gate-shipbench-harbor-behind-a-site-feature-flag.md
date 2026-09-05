---
title: Gate ShipBench Harbor behind a site feature flag
status: done
priority: high
assignee: claude
tags:
  - site
  - harbor
created: '2026-09-05T16:08:13.520Z'
updated: '2026-09-05T16:08:18.698Z'
---

Harbor is built but not yet deployed, so every Harbor entry point on shipbench.dev promised something a visitor could not reach: four header links, a footer link, the landing-page CTA, and a `/docs/harbor/` page explaining how to sign in.

Gate all of it behind `SITE_CONFIG.harborEnabled`.

## Scope

The flag gates **entry points, not Harbor's existence in the docs**. Harbor's appearances in `convention-spec.md`, `cli-reference.md`, and `recipe-gitignore-layout.md` stay: `init --harbor` and `connect --harbor` are real commands today, and the reason to commit `layout.json` is Harbor-shaped whether or not Harbor is reachable. Scrubbing those would make the docs wrong, not merely quieter.

With the flag off:

- Nothing links to `harborUrl`. The landing teaser goes as a whole block — a section describing a hosted client and then declining to link to it is a worse answer than silence.
- `/docs/harbor/` is dropped from the build through one `visibleDocs()` filter over the collection, so it leaves the routes, sidebar, pagination, sitemap, and Pagefind index together rather than one at a time. Pagefind indexes `dist/`, so not building the page is what removes it from search.

## Notes

The flag lives in `src/config/flags.ts` rather than `config/site.ts`, which reads `__SHIPBENCH_VERSION__` — a build-time define vitest does not inject, so importing it from a test throws before any assertion runs.

Markdown cannot branch on a flag, so the two prose links to the gated page are removed by hand (`overview.md`'s Reference bullet and the README's). `src/test/docs-routes.test.ts` holds both directions of that line so it is mechanical rather than remembered: a link to a doc the build omits fails, and a built doc nothing links to fails. Flip the flag, run the suite, and it names the prose that has to follow.

An MDX migration with a `<FeatureFlag>` component was considered and deferred. `markdown.processor: satteri(...)` is a whole-pipeline replacement and `satteri-table-regions.mjs` is written against satteri's plugin API, so adding `@astrojs/mdx` would fork the docs into two rendering engines and silently drop accessible table scroll regions from any converted page. That question has to be settled before MDX, independent of how much it would be used.

## Verification

Both flag states: off builds 11 doc pages with no `harbor.shipbench.dev` or `/docs/harbor` anywhere in `dist/` and no sitemap entry; on builds 12, restores the teaser, and links Harbor from all 13 pages. Typecheck, lint, 118 unit tests, and the 51 `built-output.spec.ts` probes pass in both.

## Task Updates

### 2026-09-05T16:08:18.698Z
Created and closed inside the feature branch rather than the canonical checkout, at the owner's explicit direction for this task: the pull request serves as the review phase, so it lands as done rather than passing through review.
