---
title: Concurrent Agents with Worktrees
description: Run several agents at once by giving each task its own Git worktree and branch, while one canonical checkout keeps task status authoritative.
group: Workflows
order: 2
updated: 2026-08-08
---

Two agents writing in one checkout can collide in source files, task files, dependency installs, and test output. Git worktrees give each concurrent task its own directory and branch while sharing the repository's object database.

Use one worktree for one task:

```text
1 task ↔ 1 branch ↔ 1 worktree ↔ 1 agent
```

Worktrees are an isolation tool, not the default requirement for sequential work. If you are running one agent at a time, the [solo trunk workflow](/docs/solo-trunk-workflow/) is enough.

## Route status through the canonical checkout

A ShipBench board is branch-local: each worktree carries its own copy of `.shipbench/`, and a status change made on a task branch is invisible everywhere else until that branch merges. Designate one checkout as the **canonical board** — normally the main working copy, where `shipbench board` runs — and target it with `-C` for every status change:

```bash
shipbench -C ~/code/my-project task move build-api --to in-progress
```

The rule is narrow on purpose. From inside its worktree, an agent may still write to the board files that belong to its own task:

- append Updates with `shipbench task comment`;
- refine its own task's description;
- create follow-up tasks it discovers along the way.

Those changes ride the task branch and merge in with the code. What an agent must not do from a worktree:

- change any task's `status` — that happens only in the canonical checkout;
- edit a task description without first reading the current version from the canonical checkout, since the worktree's copy may be stale;
- touch anything else under `.shipbench/`: other agents' tasks, `config.json`, `layout.json`.

One directory owns status; task branches carry everything else. [Recipe: multi-agent worktree rules](/docs/recipe-worktree-rules/) has this stated as a block you can paste into your repository's `AGENTS.md`, so each agent reads it without you repeating it in a prompt.

## Claim concurrent tasks in the canonical checkout

Before dispatching an agent, move its task to `in-progress` in the canonical checkout. You can do this from any directory:

```bash
shipbench -C ~/code/my-project task list --available --json

shipbench -C ~/code/my-project task move build-api --to in-progress
shipbench -C ~/code/my-project task move build-ui --to in-progress
```

The claim is a working-tree change and does not need its own commit. The live board shows it immediately, and the status change rides into the task's eventual completion commit. Each worktree's copy of the task will still read `todo` — that is expected; a worktree's board is never authoritative.

Create each worktree from `main`:

```bash
git worktree add -b task/build-api \
  ../my-project-worktrees/build-api main

git worktree add -b task/build-ui \
  ../my-project-worktrees/build-ui main
```

Placing worktrees in a sibling directory keeps the main repository's development servers and file watchers from scanning them.

## Agent loop inside a worktree

Read the narrowest thing that answers the question. Start with body-free list or search metadata, then retrieve one task by slug. The same rule applies to direct file access: read one task file when enough, and read multiple descriptions or archived tasks only when needed.

Give each agent one slug and the repository's normal instructions. From inside
the task worktree, use `-C` to read the authoritative task from the canonical
checkout:

```bash
shipbench -C ~/code/my-project task get build-api
shipbench -C ~/code/my-project task graph --json

# Implement, test, and record time-anchored decisions when useful.
shipbench task comment build-api \
  "Kept cursor pagination after measuring the full-result query."
```

The agent should commit code, tests, its own task's description changes, and Updates on its task branch. It should not change any task's `status` from the worktree, touch another agent's task, or create orchestration state outside the repository.

Decide which status represents a finished agent handoff and write it down. With the default columns, the task can stay `in-progress` until a human verifies it. If you would rather agents signal "done with my part" without closing the task, add [Recipe: human review gate](/docs/recipe-review-gate/).

## Integrate on `main`

Review each branch in its worktree, then merge it into `main` using your preferred Git strategy. After the integrated result passes verification, move the task to the configured completion column. `-C` keeps that status write rooted in the canonical checkout even if your shell is still in the task worktree:

```bash
git switch main
git merge task/build-api

# Verify the integrated result, then close the task.
shipbench -C ~/code/my-project task move build-api --to done
git add .shipbench
git commit -m "Complete build-api"
```

This sequence keeps `main` authoritative throughout the work:

- the claim is visible before dispatch;
- implementation stays isolated;
- the completed task reaches `done` only after integrated verification.

Clean up when the branch is no longer needed:

```bash
git worktree remove ../my-project-worktrees/build-api
git branch -d task/build-api
```

## Multi-agent cheat sheet

| Phase | Where | Action |
| --- | --- | --- |
| Select | `main` | `shipbench task list --available --json` |
| Inspect | `main` | `shipbench task get <slug>` |
| Claim | `main` | Move every dispatched task to `in-progress`; no commit needed. |
| Isolate | `main` | Create one branch and worktree per task. |
| Execute | Task worktree | Implement, test, and commit only that task's work. |
| Update | Task worktree | Comment on and refine the assigned task; create follow-up tasks. |
| Submit | Canonical checkout | Move the task to an optional `review` column, or leave it `in-progress`. |
| Integrate | `main` | Review and merge the task branch. |
| Complete | `main` | Verify the integrated result, move to `done`, and commit. |
| Clean up | `main` | Remove the worktree and delete the merged branch. |

Use `shipbench task list --blocked --json` when a candidate cannot start, `task graph --json` when the dependency path is unclear, and `task search <query> --all --json` when earlier work may contain relevant context.

## Conventions worth writing down

Three optional pieces of this workflow have pasteable blocks, so your agents read the rules instead of being told them each time:

- [Recipe: multi-agent worktree rules](/docs/recipe-worktree-rules/) — the status rule above, as agent instructions.
- [Recipe: human review gate](/docs/recipe-review-gate/) — a `review` column plus the ownership line that makes it mean something.
- [Recipe: gitignore `layout.json`](/docs/recipe-gitignore-layout/) — worth reading if merges keep conflicting on board order.
