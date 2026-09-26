---
title: 'Recipe: Gitignore layout.json'
description: Stop committing the board's manual ordering index to remove the most conflict-prone file in .shipbench/, and tell agents to read board order from the CLI instead.
group: Workflows
order: 5
updated: 2026-09-26
---

## What it does

Keeps `.shipbench/layout.json` out of Git. The file records a partial index of manual drag placements and is rewritten by every reorder, which makes it the most conflict-prone file in `.shipbench/` — two branches that each touched the board will each have rewritten it.

## When you'd want it

When your workflow is worktree-heavy and merges keep conflicting on board order — a conflict with no meaningful resolution, since neither side is more correct than the other and the file is machine-managed either way.

Keep it committed if you rely on manual ordering across machines. That's what ignoring it costs.

:::harbor
Keep it committed as well if you view boards in ShipBench Harbor and want your drag order to appear there.
:::

## The block

Add to `.gitignore`:

```text
.shipbench/layout.json
```

A missing or ignored layout file is valid — boards fall back to deterministic ordering. The canonical checkout keeps its local copy, so your own drag ordering survives on your machine; it just stops syncing to fresh clones and other machines.

Then tell agents where board order actually comes from, since an ignored file is now sometimes absent and sometimes stale. Paste into your repository's root `AGENTS.md`:

```text
## Task board: reading board order

`.shipbench/layout.json` is not committed in this project. Your checkout may
have no copy of it, or a stale one. Never read it to determine the board's
visible order.

Use the CLI instead:

    shipbench task list --json

Live tasks come back in configured column order and visible within-column
order, and each task carries a zero-based `position` within its column. If the
CLI is unavailable, combine task statuses with `config.json` and the ordering
rules in `.shipbench/README.md`; never infer visible order from `layout.json`
alone.

Do not hand-edit `layout.json`. Reordering happens through
`shipbench task move` with a placement flag (`--top`, `--bottom`,
`--before <slug>`, `--after <slug>`, `--position <n>`), and only when a human
asks for it.
```

## Tradeoffs

**Manual ordering stops being shared.** It becomes a local view preference. A fresh clone and a second machine both fall back to deterministic ordering rather than your arrangement.

:::harbor
**Harbor shows a different board than you do.** ShipBench Harbor reads the repository through the GitHub API, so it sees whatever is committed. With `layout.json` ignored, that is nothing, and Harbor's ordering will not match the board on your machine. If you use Harbor to view boards, that mismatch is the real cost of this recipe.
:::

**It removes a conflict rather than resolving one.** If manual ordering matters enough that you would have wanted to keep one side of those merges, ignoring the file does not give you that — it gives you neither side. Take `--ours` on the conflict instead and leave the file committed.
