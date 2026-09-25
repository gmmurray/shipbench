---
title: Concurrent Agents with Worktrees
description: Run several agents at once by giving each task its own Git worktree and branch, while one canonical checkout keeps task status authoritative.
group: Workflows
order: 2
updated: 2026-09-24
---

Two agents writing in one checkout can collide in source files, task files, dependency installs, and test output. Git worktrees give each concurrent task its own directory and branch while sharing the repository's object database.

Use one worktree for one task:

```text
1 task ↔ 1 branch ↔ 1 worktree ↔ 1 agent
```

If you run one agent at a time, you don't need any of this. The [solo trunk workflow](/docs/solo-trunk-workflow/) is enough.

## Route status through the canonical checkout

A ShipBench board is branch-local: each worktree carries its own copy of `.shipbench/`, and a status change made on a task branch is invisible everywhere else until that branch merges. Designate one checkout as the **canonical board** — normally the main working copy, where `shipbench board` runs — and target it with `-C` for every status change:

```bash no-copy
shipbench -C ~/code/my-project task move <slug> --to <status>
```

That rule covers status only. From inside its worktree, an agent can still write to its own task:

- append Updates with `shipbench task comment`;
- refine its own task's description or metadata (tags, priority, dependencies) with `shipbench task edit` — but not its `status`, which stays with `task move`;
- create follow-up tasks it discovers along the way.

Those changes ride the task branch and merge in with the code. What an agent must not do from a worktree:

- change any task's `status` — that happens only in the canonical checkout;
- edit a task description without first reading the current version from the canonical checkout, since the worktree's copy may be stale;
- touch anything else under `.shipbench/`: other agents' tasks, `config.json`, `layout.json`.

[Recipe: multi-agent worktree rules](/docs/recipe-worktree-rules/) has these rules as a block you can paste into your repository's `AGENTS.md`, so every agent reads them without you repeating them in a prompt.

## One writer at a time per task file

Dividing the writes this way isn't enough by itself, because both sides write to the same file. A task's entire record is `.shipbench/tasks/<slug>.md`: the canonical checkout writes `status` there, the branch writes Updates and the description there, and every one of those writes also stamps the `updated:` line directly under `status:`. (`layout.json` is the other file both sides reach, though only when a task is created or changes column; [the recovery section](#recovering-a-collided-merge) covers it.)

Git merges that content fine. What it won't do is start a merge that would overwrite an uncommitted local edit. So if a status write is sitting uncommitted in the canonical checkout while that task's branch is unmerged, the merge aborts:

```text
error: Your local changes to the following files would be overwritten by merge:
	.shipbench/tasks/build-api.md
Please commit your changes or stash them before you merge.
```

If you commit the status write instead, the merge starts and then conflicts on the `updated:` line that both sides rewrote. [Recovering a collided merge](#recovering-a-collided-merge) covers both cases.

The way to avoid both is timing. While a task branch exists, it owns that task's file, so status writes happen before it's created or after it merges:

- **before the worktree exists** — the claim, committed, so the branch inherits it;
- **after the branch merges** — `review`, `done`, and anything else.

The window is per task. Another task's uncommitted claim, comment, or description edit in the canonical checkout passes through the merge untouched, because a task branch never writes another task's file.

## Claim concurrent tasks, then commit the claim

Before dispatching an agent, move its task to `in-progress` in the canonical checkout. You can do this from any directory:

```bash
shipbench -C ~/code/my-project task list --available --json

shipbench -C ~/code/my-project task move build-api --to in-progress
shipbench -C ~/code/my-project task move build-ui --to in-progress
```

Commit the claim before any worktree exists:

```bash
git -C ~/code/my-project add .shipbench
git -C ~/code/my-project commit -m "Claim build-api and build-ui"
```

Then create each worktree from `main`:

```bash
git worktree add -b task/build-api \
  ../my-project-worktrees/build-api main

git worktree add -b task/build-ui \
  ../my-project-worktrees/build-ui main
```

Each branch now starts from a commit that already includes the claim, so an agent reading its task inside the worktree sees `in-progress` instead of a stale `todo`. The merge later compares against that same commit, which keeps the integration clean.

Putting worktrees in a sibling directory keeps the main repository's dev servers and file watchers from scanning them.

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

The agent should commit code, tests, its own task's description changes, and Updates on its task branch. It should not change any task's `status`, touch another agent's task, or create orchestration state outside the repository.

An agent that finishes commits and stops. Its task stays `in-progress` because the branch with the work hasn't merged yet, so the list of finished agents is the list of unmerged task branches:

```bash
git -C ~/code/my-project branch --list 'task/*' --no-merged main
```

To give the board its own name for work that is integrated and waiting on you, add [Recipe: human review gate](/docs/recipe-review-gate/).

## Integrate on `main`

Review each branch in its worktree, then merge it into `main` however you normally merge. The branch's Updates and description edits arrive with the code. Move the task after the merge, when its file has one writer again:

```bash
git switch main
git merge --no-edit task/build-api

# Verify the integrated result, then close the task.
shipbench -C ~/code/my-project task move build-api --to done
git add .shipbench
git commit -m "Complete build-api"
```

This order keeps `main` authoritative the whole time:

- the claim is visible before dispatch, and committed before the branch exists;
- implementation stays isolated;
- the completed task reaches `done` only after integrated verification.

Clean up when the branch is no longer needed:

```bash
git worktree remove ../my-project-worktrees/build-api
git branch -d task/build-api
```

## Recovering a collided merge

Both failures above come from a status write in the canonical checkout for a task whose branch hasn't merged. The recovery is the same for both: take what the branch has, then write the status again with the CLI.

Every command below runs in the canonical checkout, where the half-finished merge is, so none of them needs `-C`.

Don't restore the old file to get the status back. A task file holds its description, its Updates, and the `updated` timestamp that covers them, so restoring its old contents with `git stash pop`, `git checkout --ours`, or a saved copy brings back content the branch has since changed. `shipbench task move` writes only the field you meant to change, on top of whatever the merge produced.

**The merge aborted.** The status write is uncommitted. Restore the single file it touched, merge, and move the task again:

```bash
git restore .shipbench/tasks/build-api.md
git merge --no-edit task/build-api
shipbench task move build-api --to review
```

Naming the one file leaves everything else alone. If another task was claimed or commented on in the canonical checkout and not yet committed, that work survives. Don't widen this to `git restore .shipbench` or a branch-wide reset, which would throw it away.

**The merge conflicted on the task file.** The status write is committed, and conflict markers surround the `updated:` line. The `status:` line above them merged cleanly, because only `main` changed it. Take the branch's copy whole, then put the status back:

```bash
git checkout --theirs .shipbench/tasks/build-api.md
git add .shipbench/tasks/build-api.md
git commit --no-edit
shipbench task move build-api --to review
```

`--theirs` discards every change the canonical checkout made to that file. That's only safe because the status write was the only one, and the last line puts it back.

**The conflict is in `layout.json`.** A follow-up task created on the branch and a status move in the canonical checkout both rewrite the placement index. Keep the canonical copy and finish the merge:

```bash
git checkout --ours .shipbench/layout.json
git add .shipbench/layout.json
git commit --no-edit
```

`layout.json` is a partial index, so the branch's new task still appears on the board. It's placed in the default order rather than where the branch put it, until the next board write updates the index. If these conflicts are routine for you, [gitignore layout.json](/docs/recipe-gitignore-layout/) takes the file out of merges entirely.

## Multi-agent cheat sheet

| Phase | Where | Action |
| --- | --- | --- |
| Select | `main` | `shipbench task list --available --json` |
| Inspect | `main` | `shipbench task get <slug>` |
| Claim | `main` | Move every dispatched task to `in-progress`, and commit the move. |
| Isolate | `main` | Create one branch and worktree per task, from the claim commit. |
| Execute | Task worktree | Implement, test, and commit only that task's work. |
| Update | Task worktree | Comment on and refine the assigned task; create follow-up tasks. |
| Submit | Task worktree | Commit and stop. The status stays where the claim left it. |
| Integrate | `main` | Review and merge the task branch. |
| Review | `main` | Optional: move the merged task to a `review` column. |
| Complete | `main` | Verify the integrated result, move to `done`, and commit. |
| Clean up | `main` | Remove the worktree and delete the merged branch. |

Use `shipbench task list --blocked --json` when a candidate cannot start, `task graph --json` when the dependency path is unclear, and `task search <query> --all --json` when earlier work may contain relevant context.

## Conventions worth writing down

Three optional parts of this workflow have blocks you can paste into your agent instructions, so agents read the rules instead of being told them each time:

- [Recipe: multi-agent worktree rules](/docs/recipe-worktree-rules/) — the status rule above, as agent instructions.
- [Recipe: human review gate](/docs/recipe-review-gate/) — a `review` column plus the ownership line that makes it mean something.
- [Recipe: gitignore `layout.json`](/docs/recipe-gitignore-layout/) — worth reading if merges keep conflicting on board order.
