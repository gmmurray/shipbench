---
title: Document running several ShipBench boards in one repository
status: todo
priority: medium
tags:
  - docs
  - site
  - convention
created: '2026-09-26T19:44:04.592Z'
updated: '2026-09-26T19:44:04.592Z'
---

Several boards in one repository already work: each subdirectory gets its own
`.shipbench/`, reached with `cd` or `-C`. Nothing in the docs says so, and the
part that makes it work with agents is not obvious.

Source: [the multiple-boards spike](../../docs/audits/multiple-boards-in-one-repository-spike.md),
sections 2, 5, and 6. Everything the page states was verified there against the
built CLI.

## What the page covers

- When to use one board with tags (a shared workflow, dependencies across parts)
  versus nested boards (different columns, cadence, or agent instructions).
- Creating a nested board with `shipbench -C <dir> init`, and reaching it with
  `-C` or `cd`.
- A routing block for the root agent instructions that names each board and its
  `-C` command. Each board's own `AGENTS.md` stays the contract.
- Running two browser boards at once. The second falls back to the next free
  port, or use `--port`.
- `depends_on` cannot cross boards. Link to a sibling board's task file in the
  description instead.
- Harbor shows only the board at the repository root.
- With worktrees, `-C` targets the board's directory inside the canonical
  checkout.

Put this in a recipe page or a section of an existing guide, whichever the site
structure favors. Follow the approved docs voice.
