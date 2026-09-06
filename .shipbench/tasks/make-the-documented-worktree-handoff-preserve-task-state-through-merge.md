---
title: Make the documented worktree handoff preserve task state through merge
status: todo
priority: high
tags:
  - workflows
  - docs
  - git
  - cli
created: '2026-09-05T21:33:37.486Z'
updated: '2026-09-05T21:33:37.486Z'
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
