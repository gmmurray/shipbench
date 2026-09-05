---
title: Split the three mixed synopsis-and-example blocks in cli-reference
status: todo
priority: medium
tags:
  - site
  - docs
created: '2026-09-05T20:10:47.944Z'
updated: '2026-09-05T20:10:47.944Z'
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
