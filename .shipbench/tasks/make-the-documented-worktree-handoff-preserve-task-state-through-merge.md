---
title: Make the documented worktree handoff preserve task state through merge
status: done
priority: high
tags:
  - workflows
  - docs
  - git
  - cli
created: '2026-09-05T21:33:37.486Z'
updated: '2026-09-06T20:11:09.086Z'
---

The September 5 evaluation reproduced a failure in the documented concurrent-agent workflow using the local v0.4.0 CLI in a disposable Git repository. The guide allows an uncommitted status change in the canonical checkout and an Update committed on the task branch, then shows merging that branch. Git refuses that merge because it would overwrite the local task-file edit.

## Reproduction

1. Initialize ShipBench in a disposable repository and commit a task on main.
2. In the canonical checkout, move the task to in-progress and leave that change uncommitted.
3. Create a task worktree from committed main.
4. Append an Update to that task from the worktree and commit it there.
5. Merge the task branch into the canonical checkout.

Observed: Git aborts with "Your local changes to the following files would be overwritten by merge", naming the task Markdown file. The task branch and canonical checkout both legitimately changed it.

## Decisions before implementation

Choose and document how canonical status, description edits, Updates, and their timestamps survive integration. Evaluate the full consequence of the chosen approach; merely saying to commit or stash is insufficient if it moves the collision to the next step or restores stale task state. Preserve unrelated tasks and other in-flight work in the canonical checkout.

Keep the chosen solution within ShipBench's convention-based architecture. Additional CLI behavior should follow from a demonstrated need, not be assumed.

## Acceptance

- A fresh user can follow the full sequence from selection and dispatch through review, merge, completion, and cleanup without inventing an integration step.
- Demonstrate preservation of canonical status and task-branch Updates and description changes, including when another task has uncommitted changes in the canonical checkout.
- Cover any relevant merge conflict and recovery path explicitly. Never recommend blanket resets, dropping task edits, or treating a stale worktree board as authoritative.
- Add focused verification of the documented procedure using real temporary Git repositories.
- Align the concurrent workflow, worktree recipe, dogfood instructions, and any scaffold guidance that actually states the affected rule. Respect this repository's human review gate.

Start with [concurrent agents](../../apps/site/src/content/docs/concurrent-agents.md), [the worktree recipe](../../apps/site/src/content/docs/recipe-worktree-rules.md), and [dogfood instructions](../AGENTS.md).

## Task Updates

### 2026-09-06T20:01:47.732Z
Fixed by timing rather than by new CLI behavior.

The collision has one cause: `.shipbench/tasks/<slug>.md` is the only file the canonical checkout and a task branch both write. The canonical checkout writes `status`, the branch writes Updates and the description, and both stamp the `updated:` line directly under `status:`. Git merges that content fine; what it refuses is starting a merge over an uncommitted local edit.

So the branch owns its task's file for as long as it exists, and status writes go on either side of it:

- The claim is committed before `git worktree add`, so the branch inherits it. This also removes a documented wart — the worktree's copy no longer reads a stale `todo`.
- No status write for that task while its branch is unmerged, from either directory. `review` and `done` happen after the merge.

Committing the claim late instead of early was measured, not assumed: it moves the failure rather than removing it, conflicting on the `updated:` line. `git stash` is worse — the merge succeeds and `stash pop` then reinstates the pre-merge file, reverting the Updates that just merged in. That is why every recovery path re-applies status with `shipbench task move` instead of restoring a task file's bytes, and why each one names a single file so another task's uncommitted work in the canonical checkout survives.

Consequence for the review gate, stated in the recipe: with worktrees, `review` means "integrated and awaiting your verification" rather than "an agent believes it is finished". The pre-merge queue moves to Git — `git branch --list 'task/*' --no-merged main`.

No CLI change. The ordering was sufficient on its own, so nothing here demonstrated a need for new behavior. `shipbench init` does not scaffold worktree guidance, so no scaffold text stated the affected rule; the change lands in the concurrent-agents page, the worktree-rules recipe, the review-gate recipe, and this repo's own `.shipbench/AGENTS.md`.

Verified in `apps/cli/src/cli.worktree.integration.test.ts` — seven tests over real temporary repositories, worktrees, and merges: the documented sequence, the truthful worktree board, unrelated in-flight work surviving the merge, the original failure as a regression guard, and the three recovery paths (aborted merge, conflicted task file, conflicted `layout.json`).
