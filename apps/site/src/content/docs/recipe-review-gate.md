---
title: 'Recipe: Human Review Gate'
description: Add a review column and the ownership line that makes it mean something, so agents can submit finished work without marking it complete.
group: Workflows
order: 4
updated: 2026-08-08
---

## What it does

Adds a `review` column between `in-progress` and `done`, and reserves `done` for you. Agents get a way to say "I believe this is finished" that is distinct from "this is verified and closed" — a distinction the default three columns cannot express.

## When you'd want it

When agents produce work you intend to check before accepting. The default lifecycle forces a choice between leaving finished work in `in-progress`, where it looks unstarted, and letting an agent close its own task, which makes `done` mean "an agent thinks so."

It pays off most with [concurrent agents](/docs/concurrent-agents/), where several tasks finish while you are reading the first one, and the board is the only thing tracking which are waiting on you.

## The block

Two parts. First, the column in `.shipbench/config.json`:

```json
{
  "columns": [
    { "id": "todo", "label": "To Do" },
    { "id": "in-progress", "label": "In Progress" },
    { "id": "review", "label": "Review" },
    { "id": "done", "label": "Done" }
  ],
  "default_column": "todo",
  "done_column": "done"
}
```

The lifecycle becomes:

```text
todo → in-progress → review → done
```

Second, the ownership rule. A column alone changes nothing — an agent that does not know who owns `done` will still move a task there. Paste this into your repository's root `AGENTS.md`:

```text
## Task board: the review gate

This project uses a `review` column between `in-progress` and `done`.

- Move a task to `in-progress` when you start work on it.
- Move a task to `review` when the work is committed and you have verified it
  yourself: `shipbench task move <slug> --to review`.
- Never move a task to `done`. Only the human owner moves `review` to `done`,
  after reviewing the change.

Agents move verified work to review. Only the human owner moves review to done.

If you believe a task is complete, move it to `review` and say so in your
summary. Do not move it any further, and do not open a new task to represent
the same work.
```

When its work is committed on a task branch, an agent submits by targeting the canonical checkout, not the worktree's local board:

```bash no-copy
shipbench -C ~/code/my-project task move <slug> --to review
```

The submission appears on the live board immediately — before the merge — so the board reflects reality while branches are still in flight. You review the branch, merge it, verify the integrated result, and move the task to `done` on `main`.

## Tradeoffs

**You become a required step.** Work accumulates in `review` at whatever rate agents produce it and leaves at whatever rate you read it. That queue is real information, but it is also a column that only grows while you are away — and a full `review` column is easy to misread as progress.

**`done` gets slower and truer.** Completion now trails verification instead of tracking it, so velocity read off the board understates what has been built. That is the intended trade: `done` stops being a claim anyone but you can make.

**It is one more column to explain.** Every agent instruction, query, and habit that assumed three columns now has a fourth to account for. Adopt it when you actually review agent work — a `review` column nobody empties is worse than not having one.

This gate is a project choice, not a ShipBench default. Other useful workflows may add `backlog`, `blocked`, `waiting`, or release-specific columns instead.
