---
title: Solo Trunk Workflow
description: Work one task at a time directly on main, so the task move and its implementation land in the same commit without a branch or pull request.
group: Workflows
order: 1
updated: 2026-08-08
---

One stream of work, no branches. You move a task to `in-progress`, implement it, move it to the completion column, and commit the code and the task change together.

## The loop

```bash
shipbench task list --available --json
shipbench task get <slug>
shipbench task move <slug> --to in-progress

# Implement and verify the task.

shipbench task move <slug> --to done
git add .
git commit -m "Complete <slug>"
```

`--available` returns tasks in the default column whose dependencies are all satisfied, ranked by priority and then age. `task get` loads the one you picked in full.

## Why there is no branch

The task and its implementation travel in the same Git history. A feature branch, a pull request, or an external task transition for every small change buys isolation you are not using — nothing else is writing to the repository, so there is nothing to isolate from.

It also keeps the board honest for free. The status change is a working-tree edit like any other, so it cannot drift from the code: whatever `main` says the task is, is what the task is.

## When to leave it

Move to [concurrent agents with worktrees](/docs/concurrent-agents) when two agents would otherwise write in the same checkout. That is the real trigger — collisions in source files, task files, dependency installs, and test output. Wanting a branch for its own sake is not.

Adopting worktrees does not undo anything here. The concurrent workflow is this loop with isolation added around it, and `main` stays the checkout that owns task status either way.
