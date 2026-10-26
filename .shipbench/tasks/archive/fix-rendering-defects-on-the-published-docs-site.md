---
title: Fix rendering defects on the published docs site
status: done
priority: high
tags:
  - docs
  - site
created: '2026-08-30T14:05:28.596Z'
updated: '2026-08-30T20:51:04.400Z'
---

Three defects on the published docs, all found in the days after launch, all reproduced on `/docs/cli-reference/` though none are specific to that page. Two of them share a root: layout that is only correct under conditions the page does not guarantee.

## What is wrong

### Prose enhancements never run after a client-side navigation

The worst of the three, and the one with the widest blast radius.

`apps/site/src/pages/docs/[...slug].astro` ends in an `is:inline` script that does three things to the rendered prose: wraps every `<table>` in a `.table-scroll` region, appends `#` permalink anchors to every `h2`/`h3`, and prepends the `aria-live` status span those anchors report into.

It runs on full page load and never again. `ClientRouter` swaps the body by replacing nodes, and a `<script>` inserted that way is inert — only the HTML parser executes scripts. Measured on the built site, navigating from `/docs/cli-reference/` to `/docs/convention-spec/`:

| | hard load | after client nav |
| --- | --- | --- |
| `.table-scroll` wrappers | 8 | 0 |
| heading anchors | 16 of 16 | 0 of 16 |
| status span present | yes | no |
| gap below a table | 28px | 0px |
| inline `<script>` present in DOM | 1 | 1 |

The script tag is still in the DOM after the swap — it just never executed. A reload restores everything, which is why this reads as intermittent: any page you land on directly is correct, and every page you navigate to is not, until you reload it.

What breaks, in order of severity:

- **Tables lose their scroll region.** `.prose table` sets `min-width: 640px` and all overflow handling lives on the wrapper, so an unwrapped table on a narrow screen cannot be scrolled to read. Content becomes unreachable, not merely ugly.
- **Tables lose their accessible name and keyboard focus.** The wrapper carries `tabIndex=0`, `role="region"`, and an `aria-label` built from the column headers. Without it, a scrollable region is unreachable by keyboard. This is why the task is `high` rather than cosmetic.
- **Tables lose all vertical spacing.** `.prose table { margin: 0 }` — the 24px/28px rhythm is entirely the wrapper's. Where the next element is a paragraph (`.prose p { margin-top: 0 }`), the gap is exactly 0.
- **Every section permalink disappears.** No `#` affordance and no copy-link behaviour.

Fix direction: the working pattern is already in this codebase. [`apps/site/src/scripts/code-copy.ts`](../../apps/site/src/scripts/code-copy.ts) is a bundled module that listens for `astro:page-load`, and copy buttons are correct after navigation — measured 15 of 15. Move the prose enhancement to a module with the same shape. Wrapping tables at build time with a rehype plugin is the stronger version: it removes a layout shift and makes the scroll region correct at first paint and without JavaScript.

**Correct the premise while you are there.** [`apps/site/src/scripts/nav.ts`](../../apps/site/src/scripts/nav.ts) states in its header comment that "an inline script re-executes on every ClientRouter swap." That is false for body scripts, as the table above shows, and it is plausibly the reason this script was left inline with no listener. A wrong belief recorded in a comment gets believed again. The two remaining `is:inline` scripts in [`BaseLayout.astro`](../../apps/site/src/layouts/BaseLayout.astro) appear unaffected — they register `document` listeners that survive swaps — but verify that rather than assuming it.

### The copy button scrolls out of its own code block

[`code-copy.ts`](../../apps/site/src/scripts/code-copy.ts) appends the button into the `<pre>`. The `<pre>` is itself the horizontal scroll container (`.prose pre { overflow-x: auto }`, `pre.copy-enabled { position: relative }`), so an absolutely positioned child scrolls with the content instead of staying pinned. Measured at 412px: scrolling a block right by 44px moved the button left by exactly 44px. It crosses the code and then leaves the visible area.

The button needs a positioned ancestor that does not scroll — a wrapper element owning `position: relative`, with `overflow-x` left on the `<pre>` and the button appended to the wrapper. `position: sticky` is the cheaper patch but sits awkwardly against `min-width: max-content` on `.prose pre code`.

### Code text inflates on mobile

`text-size-adjust` is not declared anywhere: zero occurrences in the built CSS, and `html` in [`tokens.css`](../../apps/site/src/styles/tokens.css) does not set it. That leaves Chrome Android's text autosizing free to inflate text per block, hardest where a block's layout width most exceeds the viewport — which `min-width: max-content` guarantees for any long line. It matches the reported symptom: one `<pre>` rendering at several times its authored 12px directly below a normal one.

**This diagnosis is unverified.** Desktop Chromium has no autosizer, so it cannot be reproduced with the Playwright harness; the reasoning is from the missing declaration and the shape of the symptom. Confirm on a real device before and after. If `text-size-adjust: 100%` on `html` does not fix it, the cause is something else and this section is wrong.

## Scope

- The three defects above. Not a broader docs styling pass.
- Regression coverage in [`apps/site/e2e`](../../apps/site/e2e/README.md) for the first two. Both are browser-only behaviour the vitest suite structurally cannot reach, which is what that harness exists for. A test asserting that wrappers and anchors survive a client-side route change is the one that would have caught the worst bug here.

## Constraints

- Do not solve the navigation bug by removing `ClientRouter`.
- Table spacing should be correct without JavaScript. If wrapping stays a runtime concern, the vertical rhythm still belongs on `.prose table` so the no-JS and first-paint states are right.

## Definition of done

- Tables keep their spacing, their scroll region, and their accessible region role after a client-side navigation, and after navigating away and back.
- Section permalinks survive a client-side navigation.
- The copy button stays at the block's top-right at every horizontal scroll position, at the narrowest supported width.
- Code blocks render at their authored size on a real Android device.
- `nav.ts`'s claim about inline script re-execution matches observed behaviour.
- e2e covers the navigation case and the copy button. The mobile font check is manual and its result recorded here.

## Task Updates

### 2026-08-30T20:20:03.867Z
Implemented build-time accessible table regions, ClientRouter-safe heading permalinks, a non-scrolling copy-button shell, and text-size-adjust: 100%. Verification: site unit tests 42/42; site e2e 100 passed, 1 intentionally skipped; repository typecheck and lint passed. Android manual result: unavailable on this host because no Android device or ADB is installed. The built CSS contains the adjustment, but the owner must confirm the authored code size on a real Android device during review.
