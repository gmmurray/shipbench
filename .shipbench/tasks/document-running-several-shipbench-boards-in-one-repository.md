---
title: Document running several ShipBench boards in one repository
status: done
priority: medium
tags:
  - docs
  - site
  - convention
created: '2026-09-26T19:44:04.592Z'
updated: '2026-10-26T02:21:46.106Z'
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
- With worktrees, `-C` targets the board's directory inside the canonical
  checkout.

Put this in a recipe page or a section of an existing guide, whichever the site
structure favors. Follow the approved docs voice.

## Task Updates

### 2026-10-25T23:32:53.969Z
Scope addition, agreed with the owner: decide whether the scaffolded `.shipbench/AGENTS.md` gets one line on board discovery, for example "commands work from any subdirectory of the board; `-C` names a board exactly." If it does, ship it with this page, with a changeset, as [.changeset/README.md](../../.changeset/README.md) requires for scaffold changes.

Why here: [find-the-nearest-board-above-the-current-directory](find-the-nearest-board-above-the-current-directory.md) left the scaffold alone and called it a separate decision. This page already writes the routing block for root agent instructions, so the board's own `AGENTS.md` line is the same subject seen from the other side, and deciding them together keeps the two consistent. The current scaffold is not wrong (it never says to run from the board root), so this adds a line rather than fixing one.

The outline above predates the walk-up. Revise it to match: `cd` anywhere inside a board's directory reaches that board without `-C`; writes from below a board print `Using .shipbench/ from <path>`; `init` below an existing board warns and still creates the new one; `connect` refuses below the repository root once [refuse-to-connect-a-board-below-the-repository-root-to-harbor](refuse-to-connect-a-board-below-the-repository-root-to-harbor.md) lands.

### 2026-10-26T00:49:51.735Z
Harbor was retired and `shipbench connect` removed, so drop the connect clause from the outline in the previous Update. The other three points still stand.

### 2026-10-26T01:45:23.467Z
Done, ready for review.

**Page.** A new recipe, `apps/site/src/content/docs/recipe-several-boards.md` ("Recipe: Several Boards in One Repository"), in the Workflows group after the gitignore recipe. The recipe shape fits because the page centres on a block to paste. It is linked from the Workflows recipe list and added to the e2e page list. It covers every point in the outline, revised for the walk-up as the first Update asked (the connect clause is dropped): tags versus nested boards, `-C <dir> init` and its ancestor note, reaching a board with `cd` anywhere inside it or with `-C`, the `Using .shipbench/ from <path>` write notice, the routing block, two browser boards with port fallback or `--port`, linking to a sibling board's task file in place of `depends_on`, and `-C` into the canonical checkout with worktrees.

One addition the outline didn't name: a directory with no board of its own reaches the nearest board above it, so commands run in `site/` with no `site/.shipbench/` write to the root board. The walk-up makes that true, and a nested-board user is the reader who would trip on it.

**Scaffold decision: yes, one line.** It goes under Operations in the scaffolded `.shipbench/AGENTS.md`: "Commands work from any subdirectory of the board: the CLI uses the nearest `.shipbench/` at or above the current directory. `-C <path>` names a board's directory exactly." It matches the routing block, which tells agents to use `-C`. It ships with a patch changeset (`scaffold-board-discovery.md`, naming `shipbench`) and an `init.test.ts` assertion. I added the same line to this repo's `.shipbench/AGENTS.md` to keep it close to the scaffold.

**Verified against the built CLI** in a throwaway repo with a root board and `packages/api/`: the nested `init` note, a list and a create from `packages/api/src/` (the create printed the notice), a root `depends_on` on the api slug rejected with `Unknown dependency`, a board-less `site/` reaching the root board, and two `board web` servers at once on 4321 and 4322, each serving its own directory. The board renders a cross-board link as a plain path and doesn't open it in place. I checked that in `Markdown.tsx` and `links.ts`; it isn't probed.

**Checks.** Core tests (394), site vitest (122), typecheck, and lint pass. The site builds, and `built-output.spec.ts` passes (77), including the new page.
