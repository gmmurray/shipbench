---
title: Concurrent Agents with Worktrees
description: Run several agents at once by giving each task its own Git worktree and branch, while one canonical checkout keeps task status authoritative.
group: Workflows
order: 2
updated: 2026-09-06
---

Two agents writing in one checkout can collide in source files, task files, dependency installs, and test output. Git worktrees give each concurrent task its own directory and branch while sharing the repository's object database.

Use one worktree for one task:

```text
1 task ↔ 1 branch ↔ 1 worktree ↔ 1 agent
```

Worktrees are an isolation tool, not the default requirement for sequential work. If you are running one agent at a time, the [solo trunk workflow](/docs/solo-trunk-workflow/) is enough.

## Route status through the canonical checkout

A ShipBench board is branch-local: each worktree carries its own copy of `.shipbench/`, and a status change made on a task branch is invisible everywhere else until that branch merges. Designate one checkout as the **canonical board** — normally the main working copy, where `shipbench board` runs — and target it with `-C` for every status change:

```bash no-copy
shipbench -C ~/code/my-project task move <slug> --to <status>
```

The rule is narrow on purpose. From inside its worktree, an agent may still write to the board files that belong to its own task:

- append Updates with `shipbench task comment`;
- refine its own task's description with `shipbench task edit`;
- create follow-up tasks it discovers along the way.

Those changes ride the task branch and merge in with the code. What an agent must not do from a worktree:

- change any task's `status` — that happens only in the canonical checkout;
- edit a task description without first reading the current version from the canonical checkout, since the worktree's copy may be stale;
- touch anything else under `.shipbench/`: other agents' tasks, `config.json`, `layout.json`.

One directory owns status; task branches carry everything else. [Recipe: multi-agent worktree rules](/docs/recipe-worktree-rules/) has this stated as a block you can paste into your repository's `AGENTS.md`, so each agent reads it without you repeating it in a prompt.

## One writer at a time per task file

Splitting the writes by *what* is not enough on its own, because both halves land in the same file. `.shipbench/tasks/<slug>.md` is the only thing the canonical checkout and a task branch both edit: the canonical checkout writes `status`, the branch writes Updates and the description, and every one of those writes also stamps the `updated:` line directly under `status:`.

Git merges that content without complaint. What it refuses is *starting* a merge that would overwrite an uncommitted local edit — so a status write left sitting in the canonical checkout while that task's branch is unmerged aborts the merge that would have integrated the work:

```text
error: Your local changes to the following files would be overwritten by merge:
	.shipbench/tasks/build-api.md
Please commit your changes or stash them before you merge.
```

Committing it instead lets the merge start, and then it conflicts on the `updated:` line that both sides rewrote. Neither state is one to work from, and [recovering a collided merge](#recovering-a-collided-merge) is the way out of both.

The fix is timing. A task branch owns its task's file for as long as it exists, and status writes go on either side of it:

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

Each branch now starts from a commit that already carries the claim, so the agent reading its task inside the worktree sees `in-progress` rather than a stale `todo`. That is also the commit the merge compares against later, which is what keeps the integration clean.

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

The agent should commit code, tests, its own task's description changes, and Updates on its task branch. It should not change any task's `status`, touch another agent's task, or create orchestration state outside the repository.

An agent that finishes commits and stops. Its task stays `in-progress`, because the branch carrying the work has not landed yet — so the queue of finished agents is the set of unmerged task branches:

```bash
git -C ~/code/my-project branch --list 'task/*' --no-merged main
```

To give the board its own name for work that is integrated and waiting on you, add [Recipe: human review gate](/docs/recipe-review-gate/).

## Integrate on `main`

Review each branch in its worktree, then merge it into `main` using your preferred Git strategy. The branch's Updates and description edits arrive with the code. Move the task once the merge has landed — that is the moment its file has one writer again:

```bash
git switch main
git merge task/build-api

# Verify the integrated result, then close the task.
shipbench -C ~/code/my-project task move build-api --to done
git add .shipbench
git commit -m "Complete build-api"
```

This sequence keeps `main` authoritative throughout the work:

- the claim is visible before dispatch, and committed before the branch exists;
- implementation stays isolated;
- the completed task reaches `done` only after integrated verification.

Clean up when the branch is no longer needed:

```bash
git worktree remove ../my-project-worktrees/build-api
git branch -d task/build-api
```

## Recovering a collided merge

Both failures above have one cause — a status write in the canonical checkout for a task whose branch has not landed — and one recovery: take what the branch has, then write the status again with the CLI.

Do not replay the old file to get the status back. A task file is a snapshot of its description, its Updates, and the `updated` timestamp covering them, so restoring its bytes — `git stash pop`, `git checkout --ours`, a copy you set aside — reinstates content the branch has since moved past. `shipbench task move` writes the one field you meant to change onto whatever the merge produced.

**The merge aborted.** The status write is uncommitted. Restore the single file it touched, merge, and move the task again:

```bash
git restore .shipbench/tasks/build-api.md
git merge task/build-api
shipbench task move build-api --to review
```

Naming the file keeps the recovery off everything else. A second task claimed and commented in the canonical checkout, still uncommitted, comes through unchanged — so never widen this to `git restore .shipbench` or a branch-wide reset, which would take that work with it.

**The merge conflicted on the task file.** The status write is committed, and conflict markers surround the `updated:` line. The `status:` line above them merged cleanly, because only `main` changed it. Take the branch's copy whole, then put the status back:

```bash
git checkout --theirs .shipbench/tasks/build-api.md
git add .shipbench/tasks/build-api.md
git commit
shipbench task move build-api --to review
```

`--theirs` discards every canonical-side change to that file. It is safe here only because the status write was the only one, and the last line restores it.

**The conflict is in `layout.json`.** A follow-up task created on the branch and a status move in the canonical checkout both rewrite the placement index. Keep the canonical copy and finish the merge:

```bash
git checkout --ours .shipbench/layout.json
git add .shipbench/layout.json
git commit
```

`layout.json` is a partial index, so the branch's new task still appears on the board — ordered deterministically rather than where the branch put it, and healed by the next board write. If these conflicts are routine for you, [gitignore layout.json](/docs/recipe-gitignore-layout/) takes the file out of merges entirely.

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

Three optional pieces of this workflow have pasteable blocks, so your agents read the rules instead of being told them each time:

- [Recipe: multi-agent worktree rules](/docs/recipe-worktree-rules/) — the status rule above, as agent instructions.
- [Recipe: human review gate](/docs/recipe-review-gate/) — a `review` column plus the ownership line that makes it mean something.
- [Recipe: gitignore `layout.json`](/docs/recipe-gitignore-layout/) — worth reading if merges keep conflicting on board order.
