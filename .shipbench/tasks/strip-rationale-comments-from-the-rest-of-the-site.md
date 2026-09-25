---
title: Strip rationale comments from the rest of the site
status: todo
priority: low
tags:
  - site
  - cleanup
depends_on:
  - rewrite-shipbench-s-public-copy-from-an-outline-with-a-new-landing-page
created: '2026-09-24T23:00:52.684Z'
updated: '2026-09-24T23:00:52.684Z'
---

Remove rationale comments from the site files that [rewrite-shipbench-s-public-copy-from-an-outline-with-a-new-landing-page](rewrite-shipbench-s-public-copy-from-an-outline-with-a-new-landing-page.md) didn't rewrite, following the AGENTS.md rule that comments explain code, not copy.

Keep comments that prevent a real bug: accessibility structure, focus handling, theming holes, ClientRouter lifecycle, build and Pagefind behaviour, and test comments that say why an assertion exists. Remove comments that argue for a piece of copy or a design choice. Where the reasoning is still worth keeping, it goes in a task record.

Start with `src/components`, `src/layouts`, `src/styles`, `src/config/flags.ts`, and `scripts/og`. Don't change behaviour, and run the full site suite afterwards.
