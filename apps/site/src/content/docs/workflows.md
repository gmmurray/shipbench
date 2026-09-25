---
title: Workflows
description: Choose a ShipBench development workflow — solo trunk or concurrent agents in Git worktrees — and find the conventions to paste into your project's agent instructions.
group: Workflows
order: 0
updated: 2026-09-24
---

ShipBench stores task data and provides operations on it. It doesn't prescribe a development process. Your columns define the lifecycle, and your repository's instructions define who moves work between them.

A new project has three columns:

```text
todo → in-progress → done
```

That's enough for working alone. Add a column when it answers a question you actually have, such as "what's waiting for me to review?"

## Pick a workflow

| Workflow | Use it when |
| --- | --- |
| [Solo trunk](/docs/solo-trunk-workflow/) | One stream of work at a time. The task move and the code travel in the same commit, on `main`. |
| [Concurrent agents with worktrees](/docs/concurrent-agents/) | Two or more agents working at once. One task gets one branch, one directory, and one agent. |

Worktrees isolate work that happens at the same time. When you work one task at a time, you need neither a worktree nor a feature branch. The concurrent workflow is the solo one with isolation added, so you can switch the day you first run two agents at once.

## Recipes

A recipe is one optional convention with the exact text to paste. Each page covers what it does, when you'd want it, the block itself, and its tradeoffs.

- [Recipe: multi-agent worktree rules](/docs/recipe-worktree-rules/) — keep task status truthful while agents work on branches.
- [Recipe: human review gate](/docs/recipe-review-gate/) — let agents submit finished work without marking it complete.
- [Recipe: gitignore `layout.json`](/docs/recipe-gitignore-layout/) — drop the most conflict-prone file in `.shipbench/`.

Each one is an option with tradeoffs, and using none of them is fine.

## Where conventions live

Recipes go in your repository's root `AGENTS.md`, not in the file ShipBench scaffolds. The two files answer different questions:

| File | Answers | Owned by |
| --- | --- | --- |
| `.shipbench/AGENTS.md` | How do I operate this board? | ShipBench. Written by `shipbench init`, and it describes the base features: the file format, the valid statuses, the query commands. |
| `AGENTS.md` at the repository root | How does *this project* work? | You. ShipBench never reads or writes it. |

A rule that would hold for any ShipBench project belongs in `.shipbench/AGENTS.md`, and `shipbench init` has probably written it already. A decision about your project, such as which column means "hand this back to me" or whether branches are involved, belongs in the root file, because no scaffold can guess it.

Some conventions touch both. This repository's `.shipbench/AGENTS.md` has a hand-written section on worktrees that `shipbench init` doesn't scaffold. It lives there because it's about keeping the board correct when status is branch-local, not about how the project develops software. When a convention spans both files, put it where a reader would look first and link to it from the other.
