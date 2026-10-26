---
title: Decide the docs copy-button affordance and its mobile overlay
status: done
priority: medium
tags:
  - site
  - docs
  - ux
created: '2026-09-05T16:09:35.631Z'
updated: '2026-09-05T20:13:34.753Z'
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

## Task Updates

### 2026-09-05T20:11:09.184Z
All three parts resolved. The decisions, and what each was decided against:

**1. Explicit signal — fence metadata.** Satteri threads a fence's meta string through to `codeToHast`, which Astro exposes to Shiki transformers as `options.meta.__raw`, so no MDX migration was needed and the deferral in this task's notes stands unchallenged. `src/utils/shiki-copy-meta.mjs` reads ` ```bash no-copy ` onto the `<pre>` as `data-copy="false"`, and `isMultiline()` is gone.

Copyable is the default, matching `copyable = true` in `CodeBlock.astro`, so both surfaces state one rule in their own syntax. The opt-out marks the smaller set. The rule applied: **a block opts out when its text contains a metavariable the reader must substitute** — 24 fences, all of them usage synopses. That is checkable rather than a judgement call, and it gave the 8 listed single-line commands their buttons. An unrecognised meta token fails the build naming the file and the token, so a typo cannot silently restore an affordance nobody chose.

Three blocks in `cli-reference.md` bundle a synopsis with a runnable example, so the whole block had to go `no-copy` and those examples lost their button. Splitting them is editorial rather than mechanical, so it is filed as `split-the-three-mixed-synopsis-and-example-blocks-in-cli-reference` rather than folded in here.

**2. The home-page snippet now copies.** The "illustrative" judgement did not survive inspection: these are the three real commands the section's heading promises. The two hero panes stay opted out and now say why — one renders a file `task create` writes, the other acts on a slug that exists only in the mockup.

The clipboard payload is now asserted rather than assumed, which caught two things I had wrong: the blank lines between commands survive (only *consecutive* blanks collapse), and Chromium returns CRLF on Windows against LF on the Linux runner, so the assertion normalises.

**3. The overlay is gone; the control moved into a header strip.** Measured before assuming, at 390px: the button's 36px band crossed the first code line's 16px band on **every** block, and covered actual command text on **9 of 15** — a full 56px on the most copy-worthy commands, all of them in blocks that scroll, so the covered text could not be read without scrolling it out from under the button.

The strip beat reserved top padding because it uses the space it costs: it carries the language label, and it matches `.quickstart-head`, which the landing page already puts above its code in the same tokens. It stays a sibling of the `<pre>` inside the shell, so the button still holds position while the code scrolls — `docs-rendering.spec.ts` still passes unchanged on that point — and it gave the touch target room to reach the 44px minimum, up from 36px.

After: worst overlap across 28 copyable blocks is −17px, i.e. a gap. A new geometric test asserts no button intersects its first code line and every button clears 44px; re-applying the old geometry at runtime makes it report 11 offenders, so it is not vacuous.

**Verification.** Typecheck, lint, 118 unit tests, 100 e2e (1 pre-existing skip). Both the copy-affordance change and the Harbor flag's two states build clean.
