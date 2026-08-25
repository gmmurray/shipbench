---
title: Workflows
description: Choose a ShipBench development workflow — solo trunk or concurrent agents in Git worktrees — and find the conventions to paste into your project's agent instructions.
group: Workflows
order: 0
updated: 2026-08-08
---

The ShipBench project system provides task data and safe operations without imposing a development process. Your configured columns define the lifecycle, and your repository instructions define who may move work between them.

The default project stays deliberately small:

```text
todo → in-progress → done
```

Use it as-is for a simple solo loop. Add columns only when they answer a real question in your workflow.

## Pick a workflow

| Workflow | Use it when |
| --- | --- |
| [Solo trunk](/docs/solo-trunk-workflow) | One stream of work at a time. The task move and the code travel in the same commit, on `main`. |
| [Concurrent agents with worktrees](/docs/concurrent-agents) | Two or more agents working at once. One task gets one branch, one directory, and one agent. |

Worktrees are an isolation tool, not a requirement. Sequential work needs neither a worktree nor a feature branch, and starting there costs nothing — the second workflow is the first one plus isolation, and you can move to it the day you actually run two agents.

## Recipes

A recipe is one optional convention with the exact text to paste. Each page states what the convention does, when you would want it, the block itself, and what it costs.

- [Recipe: multi-agent worktree rules](/docs/recipe-worktree-rules) — keep task status truthful while agents work on branches.
- [Recipe: human review gate](/docs/recipe-review-gate) — let agents submit finished work without marking it complete.
- [Recipe: gitignore `layout.json`](/docs/recipe-gitignore-layout) — drop the most conflict-prone file in `.shipbench/`.

These are options with stated tradeoffs, not best practices, and adopting none of them is a supported answer. ShipBench ships the data and the operations; the process is yours.

## Where conventions live

Recipes target your repository's root `AGENTS.md`, not the file ShipBench scaffolds. The two answer different questions:

| File | Answers | Owned by |
| --- | --- | --- |
| `.shipbench/AGENTS.md` | How do I operate this board? | ShipBench. Written by `shipbench init`, and it describes the base features: the file format, the valid statuses, the query commands. |
| `AGENTS.md` at the repository root | How does *this project* work? | You. ShipBench never reads or writes it. |

The practical test: if a rule would be true of any ShipBench project, it belongs in `.shipbench/AGENTS.md` and `shipbench init` probably already wrote it. If it is a decision you made about your project — which column means "hand this back to me", whether branches are involved — it belongs in the root file, and no scaffold can guess it.

The line is genuinely fuzzy, and this project's own repository shows it. ShipBench's `.shipbench/AGENTS.md` carries a hand-written worktree section that `shipbench init` does not scaffold. It sits there rather than in the root file because it is really about board correctness under branch-local status — an operating rule for the board — and not about how the project develops software. Expect a few conventions to touch both files. When one does, put it where a reader would look for it and cross-reference the other.
