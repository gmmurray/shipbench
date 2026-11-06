---
title: Exclude tasks by tag in task list and search
status: todo
priority: medium
tags:
  - cli
  - convention
created: '2026-10-27T20:05:59.167Z'
updated: '2026-10-27T20:05:59.167Z'
---

`--tag` on `task list` and `task search` can only include tasks: a task must carry every listed tag. There is no way to leave tasks out by tag, so "ready work, minus anything tagged `plan`" (or `spike`, or `blocked-upstream`) means filtering the JSON by hand or writing a prose rule an agent has to remember.

This came up while trialling plan tasks in another repository (see [the planning spike](spike-plans-as-a-reading-order-over-tasks-and-building-on-top-of-shipbench-vs-inside-it.md)). A plan is an ordinary task tagged `plan` that sits in a working column, so `task list --available` offers it as the next piece of work. An agent writing the convention reported twice that `task list --help` had no way to exclude it. A plan is only one case: any tag that marks a task as not-a-work-item, or not-for-agents, needs the same thing.

## Scope

Add a repeatable, comma-separated exclusion flag to `task list` and `task search`, beside `--tag`. Working name `--exclude-tag`; settle the name against the existing flag set before building.

- A task carrying **any** excluded tag is dropped. That is the opposite of `--tag`, which requires every listed tag, and the help text must say so plainly.
- Matching is case-insensitive, like `--tag` ([cli.ts](../../apps/cli/src/cli.ts) `filters.tags`).
- It combines with every other filter, `--available`, `--blocked`, `--flagged` and `--archived` included. `--tag x --exclude-tag x` returns nothing rather than erroring; it is a valid query, just an empty one.
- Check whether the TUI's tag filter ([tui/model.ts](../../apps/cli/src/tui/model.ts)) should gain the same option or deliberately stay include-only, and record the answer here.

## Acceptance

- `task list` and `task search` accept the flag in both JSON and text output, and the filter applies before `--limit`.
- Tests cover any-tag exclusion, combining it with `--tag`, and combining it with `--available`.
- The scaffolded `.shipbench/AGENTS.md` that `init` writes, this repo's copy, and the CLI reference docs on the site describe the flag alongside `--tag`.
- A changeset for the CLI. This is a new flag, so it is a minor bump.
