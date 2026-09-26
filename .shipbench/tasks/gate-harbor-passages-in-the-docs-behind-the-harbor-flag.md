---
title: Gate Harbor passages in the docs behind the Harbor flag
status: review
priority: medium
tags:
  - site
  - docs
  - harbor
created: '2026-09-26T20:06:29.500Z'
updated: '2026-09-26T20:13:42.459Z'
---

Put every Harbor passage in the docs behind the same `harborEnabled` flag that already hides the Harbor page and the landing section.

## Why

`HARBOR_ENABLED` hides `/docs/harbor/` and the landing page's Harbor section, but the flag comment keeps every other Harbor mention as "system shape". To a reader, most of those describe something they can't use:

- the overview lists Harbor as one of ShipBench's three parts;
- the CLI reference documents `init --harbor` and `connect --harbor`, which need a signed URL only Harbor can issue;
- the project files spec and the gitignore recipe explain how the board looks in Harbor.

## Design

- **Marker.** Harbor-only passages go in a `:::harbor` container block. Satteri parses `:::` blocks natively with `features: { directive: true }`, so no new dependency is needed.
- **Plugin.** An mdast plugin removes `harbor` blocks when the flag is off and unwraps them when it's on. It reads the flag from `src/config/flags.ts`, so there's still one switch.
- **Inline mentions.** Where Harbor appears mid-sentence, reword so the sentence is true either way, and move anything Harbor-specific into its own gated block.
- **CLI reference.** The Harbor flags and the `connect` command move into one gated subsection.
- **Frontmatter.** Descriptions can't be gated, so they don't mention Harbor.
- **Guard.** A vitest check fails if the word "Harbor" appears in a docs page outside a `:::harbor` block. `harbor.md` is exempt, because the build already omits it when the flag is off.
- **Launch checklist.** The one in `flags.ts` shrinks to what the flag can't reach: the root README, which GitHub renders.

## Acceptance

- With the flag off, no built docs page mentions Harbor. With it on, every gated passage renders.
- The guard test exists, and both flag states are covered by tests.
- Typecheck, lint, vitest, and Playwright pass.

## Task Updates

### 2026-09-26T20:13:42.374Z
Done, ready for review.

**How it works:**

- `astro.config.mjs` turns on satteri's `directive` feature and adds `src/utils/satteri-harbor-gate.mjs`. That plugin removes `:::harbor` blocks when `HARBOR_ENABLED` is false and renders their contents in place when it's true. Any other directive name fails the build, so a typo like `:::harbour` can't slip through. No new dependency.
- `src/utils/docs.ts` gains `withoutHarborBlocks` and `renderedMarkdown` for code that reads raw Markdown. The reading-time estimate and `docs-routes.test.ts` now see what the build renders, so a gated link to `/docs/harbor/` counts only when Harbor is on.

**Docs changes:**

- **overview:** the Harbor part is a gated paragraph, a gated link to the Harbor page follows the reference list, and the frontmatter description no longer names Harbor.
- **cli-reference:** `--harbor` is gone from the `init` synopsis and flag table. `connect` and `init --harbor` share one gated section. The `-C` note now says "every command" instead of naming `connect`.
- **convention-spec:** the client list and the `layout.json` guidance are Harbor-free, with a gated note on what Harbor sees.
- **recipe-gitignore-layout:** inline mentions reworded, and the Harbor tradeoff and a "keep it committed for Harbor" note gated.

**One thing I found along the way.** Astro caches rendered Markdown and only clears that cache when the serializable config changes. The first flag-on test build served pages still rendered with the flag off. The plugin's name now includes the flag state (`shipbench-harbor-gate:on` or `:off`), so a flip changes the config digest and clears the cache. I verified this with a warm cache: off, then on, then off again, and each build cleared the store and rendered the right content. A unit test pins it.

**Launch checklist.** The `flags.ts` comment is down to one manual step: the root README's Harbor bullet, because GitHub renders the README and the flag can't reach it.

**Tests:**

- `harbor-gate.test.ts` fails if any docs page except `harbor.md` mentions Harbor outside a `:::harbor` block.
- Unit tests cover the plugin's two modes, its per-state name, and rejecting unknown directives.
- `built-output.spec.ts` checks that no built page's text mentions Harbor while the flag is off.

Typecheck, lint, 139 vitest tests, and Playwright (104 passed, 1 skipped as before) all pass. Flag-on output was checked in a temporary build: every gated passage rendered and `shipbench connect` appeared in the page's table of contents. The flag is back to false.
