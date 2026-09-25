---
title: Solo Trunk Workflow
description: Work one task at a time directly on main, so the task move and its implementation land in the same commit without a branch or pull request.
group: Workflows
order: 1
updated: 2026-09-24
---

Work one task at a time on `main`, without branches. You move a task to `in-progress`, do the work, move the task to the completion column, and commit the code and the task change together.

## The loop

```bash no-copy
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

When only one thing writes to the repository, a feature branch or pull request for each change adds steps without protecting anything. Skipping them also keeps each task and its implementation in the same history.

Moving a task is a working-tree edit like any other, so the status change goes into the same commit as the code. Finishing the work and recording that it's finished happen together, in one place. You still have to keep the task's description true to what you built, but you don't also have to update a second system.

## When to leave it

Switch to [concurrent agents with worktrees](/docs/concurrent-agents/) when two agents would otherwise write in the same checkout and collide in source files, task files, dependency installs, or test output.

Nothing here has to be undone when you switch. The concurrent workflow is this loop with isolation around it, and `main` is still the checkout that owns task status.
