---
title: 'Recipe: Multi-Agent Worktree Rules'
description: A pasteable AGENTS.md block that keeps task status truthful when agents work from Git worktrees, by routing every status change through the canonical checkout.
group: Workflows
order: 3
updated: 2026-08-08
---

## What it does

Tells every agent that the board is branch-local: one checkout owns task `status`, and a worktree may write to its own task but nothing else under `.shipbench/`. Without the rule, an agent moves its task to `done` on a branch, sees the change locally, and reports success — while the live board still shows it `in-progress`.

## When you'd want it

Any time more than one agent works at once, since that is when [worktrees](/docs/concurrent-agents) start being worth their cost. It is also worth adopting the first time an agent works on a branch at all, even alone: the failure it prevents is a status change that looks applied and is not, and one agent can hit that as easily as three.

Skip it if all work happens on `main`. In the [solo trunk workflow](/docs/solo-trunk-workflow) there is only one checkout, so there is nothing for the rule to disambiguate.

## The block

Paste into your repository's root `AGENTS.md`. Replace `~/code/my-project` with the path to your canonical checkout — the main working copy on `main`, where `shipbench board` runs.

```text
## Task board in a Git worktree

The ShipBench board is branch-local. A task's `status` only means anything in
the canonical checkout: the main working copy on `main`, at `~/code/my-project`,
where the live board runs. A status change made on a task branch is invisible
everywhere else until that branch merges.

When you are working inside a feature worktree:

- Never change any task's `status` from the worktree. Run the move against the
  canonical checkout instead:

      shipbench -C ~/code/my-project task move <slug> --to <status>

  If you cannot reach the canonical checkout, say so and leave the status
  alone. Do not move the task on your branch as a substitute.

- You may write to your own task from the worktree: append Task Updates with
  `shipbench task comment`, refine its description, and create follow-up tasks
  you discover along the way. Those changes ride your branch and merge in with
  the code.

- Read before you edit. Your worktree's copy of a task may be stale. Load the
  current version from the canonical checkout with
  `shipbench -C ~/code/my-project task get <slug>` before editing a description.

- Touch nothing else under `.shipbench/`: no other agents' tasks, no
  `config.json`, no `layout.json`.

One directory owns status. Task branches carry everything else.
```

## Tradeoffs

**It hardcodes a path.** The block names your canonical checkout, so it is accurate on your machine and wrong on anyone else's. For a solo project that is the point — the agent needs a real path, not a description of one. If the repository ever gains a second developer, the path becomes the first thing to generalize.

**It constrains agents that could have been right.** An agent that correctly worked out it was in the canonical checkout would be allowed to move the task; the block tells it to route through `-C` regardless. The redundant `-C` costs nothing and removes the judgment call, which is the trade being made.

**It does not enforce anything.** ShipBench has no locking and no agent orchestration layer — `status` is a field in a Markdown file, and any tool can write it. This is a convention agents follow because they read it, and an agent that ignores its instructions will still write to the wrong board.
