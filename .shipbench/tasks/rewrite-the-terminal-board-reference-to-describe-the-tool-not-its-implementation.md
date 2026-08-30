---
title: >-
  Rewrite the terminal board reference to describe the tool, not its
  implementation
status: done
priority: medium
tags:
  - docs
  - site
  - copy
created: '2026-08-30T14:05:28.734Z'
updated: '2026-08-30T21:04:18.985Z'
---

The `shipbench board terminal` section of the [CLI reference](../../apps/site/src/content/docs/cli-reference.md) documents how the code behaves rather than what the tool does for you. It is accurate, and it is well written. It is aimed at the wrong reader.

Two paragraphs carry most of it:

> The board takes over the screen while it runs and restores what was there on exit. As the terminal narrows it degrades in fixed steps — the done column collapses to a count on the status line, then empty columns do, then columns give way to full-width stacked sections — so widening the window never shows you less. Tasks whose `status` matches no configured column are never dropped; they collect in an `UNCATEGORIZED` column that no step collapses.

> The first read is allowed to fail, because there is nothing to show yet. Every read after it is not: a broken `config.json` or a storage error keeps the last good frame on screen and puts a warning on the status line. A task file caught mid-write is not fatal at all — the board repaints normally and the file's problem shows up as a warning count instead.

These read like the invariants a test suite asserts, phrased in the vocabulary the implementation uses — "the first read", "the last good frame", "no step collapses". The reader arrives wanting to know something else: can I leave this open in a pane while I work, and will it ever lie to me?

## The test to apply

For each sentence: **does it change what the reader would do, or does it describe how the thing is built?**

Roughly what survives, as illustration rather than prescription:

- The degradation ladder becomes the promise it exists to make: "it adapts to narrow terminals, and widening the window never shows you less." The step order is spec detail.
- "The first read is allowed to fail…" becomes "if it can't start, it tells you why. Once it's running, a broken config or a failed read leaves the last good board on screen with a warning on the status line rather than clearing it."
- "A task file caught mid-write is not fatal at all" becomes "you can edit task files while it's open."

Some of the surrounding detail is genuinely user-facing and should keep the voice it already has: the read-only/no-keyboard-input paragraph, the blocked-task marker, the `NO_COLOR` and redirected-stdout behaviour, and the terminal support note. Those answer questions a user actually has.

## Scope

- The `shipbench board terminal` prose. The flag tables are fine as they are.
- One other paragraph carries the same tic: under `task list`, the `--available` versus board-order explanation ("That is expected, not a bug"). Same treatment.
- **Not the full docs pass.** `init`, `task create`, `task move`, and `task list` were read while scoping this and are properly user-facing. This is an isolated pocket, and treating it as the opening move of a site-wide rewrite is how it stops getting finished. A broader pass is its own task.

## The decision this task has to make

The cut material is correct and hard-won. Deleting it loses real information about how the board behaves under failure. Pick one home for it and apply it consistently — the current mix is the actual problem:

1. Move it to [`docs/spec.md`](../../docs/spec.md), which already carries this register.
2. Keep it in place under a clearly marked subsection ("Behaviour under failure", "Narrow terminals") that a user can skip.
3. Cut it outright and let the source be the record.

## Definition of done

- A reader who has never seen the source can tell, from the `board terminal` section, what the command does for them and what it will not do.
- No sentence states an implementation invariant purely as an invariant.
- The cut material has a decided home, applied consistently.
- The page's frontmatter `updated` date reflects the edit — it currently reads `2026-08-08`.
