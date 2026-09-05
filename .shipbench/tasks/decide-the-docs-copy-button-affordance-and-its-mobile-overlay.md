---
title: Decide the docs copy-button affordance and its mobile overlay
status: todo
priority: medium
tags:
  - site
  - docs
  - ux
created: '2026-09-05T16:09:35.631Z'
updated: '2026-09-05T16:09:35.631Z'
---

The docs site's copy affordance is decided by line count, which is the wrong signal, and the button that results overlays the code it is copying. Three related pieces, worth one pass because they all land in `src/scripts/code-copy.ts`, `src/styles/code-blocks.css`, and the blocks themselves.

## 1. Single-line runnable commands have no copy button

`addCopyButton` early-returns on `!isMultiline(pre)`, so a one-line block never gets a button. Across `src/content/docs`, of 53 shell blocks:

- 27 multi-line — button, correct.
- 18 single-line placeholders (`shipbench init [--name <name>]`) — no button, correct, but only by accident.
- **8 single-line runnable commands — no button, wrong:**

```
cli-reference.md       shipbench -C ../new-project init
cli-reference.md       shipbench task comment build-api --body-file update.md
concurrent-agents.md   shipbench -C ~/code/my-project task move build-api --to in-progress
convention-spec.md     git rm --cached .shipbench/layout.json
quickstart.md          shipbench init
quickstart.md          shipbench init --name "Acme Widgets"
quickstart.md          shipbench task create "Build the landing page"
quickstart.md          shipbench board
```

The four quickstart commands are the most copy-worthy strings on the site. Meanwhile the illustrative four-line install block above them does get a button.

`isMultiline()` is standing in for "is this runnable?" and is wrong in both directions. Replace it with an explicit signal. `CodeBlock.astro` already takes a `copyable` prop for `.astro` call sites; a Markdown fence has no equivalent, so the real question is what per-fence metadata the satteri processor exposes to `satteri-table-regions.mjs`-style plugins, or whether a language convention (```bash for runnable, ```text for grammar) carries it instead. Settle that first — it decides the shape of the rest.

## 2. The home-page snippet opts out of copying

`index.astro:173` passes `copyable={false}`, and `e2e/built-output.spec.ts` locks that in for all three home-page blocks as "illustrative."

Worth revisiting on its own terms: `code-copy.ts` already strips `.comment` spans and `.prompt` markers and collapses the blank lines, so that snippet would copy clean today as three `npx shipbench …` lines. The block is the landing page's primary call to action. Either the "illustrative" judgement still holds and should be written down as a reason, or it does not and the block should copy — possibly split into per-command blocks, since a reader wants one command at a time rather than all three at once.

## 3. Does the overlay copy button actually work, especially on mobile?

The open question, and the reason to look before changing anything.

Current geometry: `.code-copy-button` is `position: absolute; top: 8px; right: 8px` with `min-width: 56px; min-height: 36px`, inside a `.code-block-shell { position: relative }` that wraps the `<pre>`. `.prose pre` has `padding: 16px 20px` and `overflow-x: auto`, and `.prose pre code` has `min-width: max-content`, so lines never wrap — they scroll under the button. `code-blocks.css` has no width breakpoints at all; the button is the same size at 390px as at 1920px.

The result is that the button spans roughly y=8–44 while the first code line begins at y=16, so it sits **on top of** the first command. On a narrow viewport that is not a near-miss: it truncates the line mid-token and the reader cannot see what the command is without scrolling it out from under the button.

That is the fact worth weighing against "every docs site does this." Most that overlay a copy button either reserve top padding so line one clears it, shrink to an icon at narrow widths, or reveal on hover — the last of which is not available here, since a touch device has no hover and this is the viewport where it hurts.

Two constraints on any fix:

- The button is pinned to the shell rather than the scrolling `<pre>` **deliberately**, so it holds position while the code scrolls. `e2e/docs-rendering.spec.ts:89` locks that in. Preserve it, or replace that test consciously.
- Whatever lands has to keep the touch target usable; the current 36px height is already under the 44px minimum the mobile drawer links are held to in `e2e/keyboard-nav.spec.ts`.

Options worth costing: reserved top padding on `<pre>` when a button is present; an icon-only button below a breakpoint; moving the control into a header strip (the `label` prop and the fence language are both available to name the block); or concluding the occlusion is acceptable and documenting why. Deciding it is fine as-is is a legitimate outcome — but it should be decided against the screenshot rather than assumed from convention.

## Done when

The copy affordance follows an explicit runnable/illustrative signal rather than line count; the home-page block's behaviour is deliberate either way; and the mobile overlay question is resolved with a reason recorded, whether that resolution is a change or a decision to keep it.
