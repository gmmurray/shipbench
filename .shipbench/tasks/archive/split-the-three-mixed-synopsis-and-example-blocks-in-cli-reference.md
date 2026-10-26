---
title: Split the three mixed synopsis-and-example blocks in cli-reference
status: done
priority: medium
tags:
  - site
  - docs
created: '2026-09-05T20:10:47.944Z'
updated: '2026-09-05T20:27:11.653Z'
---

`cli-reference.md` has three code blocks that bundle a usage synopsis with a runnable example in one fence. The copy affordance is now a per-block signal, so a block that mixes the two can only be one thing, and the conservative answer won: all three are marked `no-copy`, which costs the runnable examples inside them their copy button.

The blocks, identified by content since line numbers move:

- The opening block under "The ShipBench CLI reads and writes…" — three real commands plus `shipbench <command> --help`.
- The `task comment edit` block — the synopsis followed by `shipbench task comment edit build-api 0 \ …`.
- The `task comment delete` block — the synopsis followed by `shipbench task comment delete build-api 0`.

Every other command section in the file already keeps its synopsis in its own fence and its examples in another, so these three are the anomaly rather than the pattern. Splitting them would let the synopsis stay `no-copy` and give the examples their button back.

This was deliberately left out of the copy-affordance task: it is an editorial change to how a docs page is structured, not a change to the copy mechanism, and it wants its own read of the page rather than being smuggled into a mechanism change.

## Done when

The three mixed blocks are split so that no fence contains both a grammar and a runnable command, and the runnable halves are copyable.

## Task Updates

### 2026-09-05T20:19:58.725Z
All three blocks split, following the pattern the rest of the file already uses: synopsis fence marked `no-copy`, a sentence, then the runnable example in its own copyable fence.

- **Orientation block.** The three real commands became copyable; `shipbench <command> --help` moved to its own `no-copy` fence under "Every command documents its own flags:".
- **`task comment edit`.** The lead sentence split at its own seam — the first half introduces the synopsis, the second ("ShipBench preserves the entry timestamp...") now introduces the example.
- **`task comment delete`.** Needed a connective that did not already exist in the prose, so I checked `deleteComment` in core rather than inventing one: it is `task.comments.splice(index, 1)`, so "Deleting shifts every entry below it up one index" is true.

Verified in the built HTML: all three examples now carry `data-copy` unset, and the synopses keep `data-copy="false"`.

## The guard, and what it does not cover

`src/test/docs-code-fences.test.ts` holds three properties over every shell fence in the collection. The first two are the marker rule — no metadata token other than `no-copy`, and a fence is `no-copy` exactly when it holds a metavariable.

Those two do **not** catch a mixed block, which I found by re-mixing one and watching the suite stay green: a fence holding a synopsis and its example satisfies the equivalence whichever way it is marked. So the third property is the one that matters here — a fence never pairs a synopsis with a concrete example of the *same* command, detected by comparing the tokens before a synopsis's first flag or placeholder against the other commands in that fence.

It is deliberately narrow. A block walking through several *different* commands, some with placeholders and some without, is a narrative rather than a mismarked pair: the agent-workflow block in this file, `solo-trunk-workflow.md`, and `harbor.md` all have that shape and all stay untouched. Verified in both directions — zero findings across the corpus as it stands, and re-mixing the delete block makes it fail naming the file, line, synopsis, and example.

**Verification.** Typecheck, lint, 122 unit tests, 100 e2e (1 pre-existing skip), clean build.
