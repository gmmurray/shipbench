---
title: Strip rationale comments from the rest of the site
status: done
priority: low
tags:
  - site
  - cleanup
depends_on:
  - rewrite-shipbench-s-public-copy-from-an-outline-with-a-new-landing-page
created: '2026-09-24T23:00:52.684Z'
updated: '2026-11-20T22:33:16.975Z'
---

Remove rationale comments from the site files that [rewrite-shipbench-s-public-copy-from-an-outline-with-a-new-landing-page](rewrite-shipbench-s-public-copy-from-an-outline-with-a-new-landing-page.md) didn't rewrite, following the AGENTS.md rule that comments explain code, not copy.

Keep comments that prevent a real bug: accessibility structure, focus handling, theming holes, ClientRouter lifecycle, build and Pagefind behaviour, and test comments that say why an assertion exists. Remove comments that argue for a piece of copy or a design choice. Where the reasoning is still worth keeping, it goes in a task record.

Start with `src/components`, `src/layouts`, `src/styles`, `src/config/flags.ts`, and `scripts/og`. Don't change behaviour, and run the full site suite afterwards.

## Task Updates

### 2026-11-20T22:32:30.288Z
Stripped copy and design rationale from the site comments; behaviour unchanged. Site vitest (122), build, typecheck, lint, and Playwright (125 passed, 1 skipped) all pass.

`src/config/flags.ts` no longer exists (removed with Harbor), so it had nothing to strip.

Reasoning removed from comments that is still worth having:

- **Header, docs version badge.** The version belongs to ShipBench, not the documentation, so it sits bare beside the wordmark instead of being labelled "Docs".
- **Header, docs nav order and label.** Links come first, then the controls, so like groups with like. The link says "Home" rather than "Overview" because `/docs/overview/` is also reachable from the docs, and two destinations both called Overview would confuse the reader.
- **OG card copy.** The card carries the tagline, not the descriptor, because the descriptor is already the page's `og:title` (AGENTS.md › Naming and branding). The subhead is the domain, which helps a card that gets screenshotted.

Kept: comments on accessibility, focus, theming, ClientRouter, Shiki/`!important`, Pagefind, touch-target minimums, WCAG contrast figures, and the template's metric-slack note. I trimmed the before/after history out of several of them and kept the constraint.
