---
title: >-
  Spike: plans as a reading order over tasks, and building on top of ShipBench
  vs inside it
status: done
priority: medium
tags:
  - spike
  - product
  - planning
created: '2026-10-27T20:05:59.260Z'
updated: '2026-10-27T20:05:59.260Z'
---

Two questions came up together: whether a planning feature belongs in ShipBench, and the general rule for what goes into ShipBench versus what gets built on its published packages. This spike was settled in a conversation between the owner and an agent, with no prototype. It records the conclusions so later work starts from them.

## The need

The owner regularly works with an agent to decide the order of the current todo and backlog tasks: "we have these, what's the right order and why?" They then sort the board to match. The sort survives; the reasoning does not. A month later the board can't say why it's in that order, and the next planning conversation starts from nothing.

A plan is therefore not a sort order. It is a decision record: an ordered sequence of tasks that crosses columns, with a reason for each step, written at a point in time. Board order (`layout.json`) is per column, carries no reasons, and is mostly about visual arrangement.

## Decision: a plan is a way of reading tasks, not of managing them

The owner wants a plan for viewing work: reading the sequence and opening each task from it. Applying a plan to board order would be a convenience ("sort by plan"), not the point.

- **No second authority for order.** A plan that only lists tasks never claims to be the board's order, so it can't drift from `layout.json`. The staleness that remains is the plan's own content: steps that finished or were archived, and new tasks the plan doesn't mention. Show that kind of staleness; don't try to prevent it. Keeping a plan current stays the writer's job.
- **Most of the value is already built.** The board opens a link to another live task file in place ([design.md](../../docs/board/design.md#markdown-links)). A task whose body is an ordered list of task links is already a clickable plan.

## Decision: start with a convention, not code

The trial is a plan written as an ordinary task, tagged `plan`, titled `Plan: …`, with one plan active at a time. The body has a dated context line, an `## Order` list of task links with a reason each, a `## Not now` list, and notes. Changes to the plan are recorded as Task Updates, and friction with the format is logged the same way, so the trial produces evidence. A plan is not a work item: agents selecting work skip it, and it never goes through review. The owner is running the trial in another repository.

Friction we expect the trial to surface, in rough order of likelihood:

1. **Getting back to the plan.** The board has no URL routing, and ESC closes the detail view rather than going back. Reading plan → task → plan → next task may be clumsy.
2. **Step status.** A plain link doesn't show whether its task is done, in progress, or flagged.
3. **Finding the plan.** It is one card among many.
4. **Steps that get archived.** A finished step that gets archived breaks its link. [Keep links between tasks working when a task is archived](keep-links-between-tasks-working-when-a-task-is-archived.md) covers this already.

The trial already found one concrete gap: an agent selecting work can't exclude a tag, so a plan in a working column shows up in `task list --available`. That gap is [Exclude tasks by tag in task list and search](exclude-tasks-by-tag-in-task-list-and-search.md). It is a general filter rather than a plan feature. A repository with a `backlog` column, where agents don't select work, could also park the plan there.

## Inside ShipBench vs. built on top

The rule already in use, stated: **core owns formats and meanings that more than one tool has to agree on, and tools own behaviour and opinions.** The `layout`, `search` and `flag` subpaths were promoted to core because the board and CLI had to agree on them, not because they were useful.

- **Belongs in ShipBench:** a data shape several readers must interpret the same way, useful to most solo users, and costing nothing when ignored (`depends_on`, `flag`).
- **Belongs on top:** anything that encodes a method (how you plan or triage), spans repositories (the personal multi-board tool), or hasn't settled its shape.
- **Either way, data stays in the repository.** A tool built on top may add its own files under `.shipbench/`, but it keeps no store of its own. The multi-board tool qualifies because it stores nothing.
- **Promotion is how things move in.** A tool can start outside and have its format promoted into core once a second reader, the board or the CLI, needs to understand it.

**Applied to plans, the case study reverses the usual answer.** Because a plan is a view, the work is rendering, and the board isn't a component library: it is one app behind `BoardAPI`. A separate plan viewer would have to re-implement task rendering or depend on board internals, which aren't supported outside this repository. So if the trial shows friction, the likely fixes are small, general board improvements, such as a status chip on task links and back navigation in the detail view. Neither is a plan feature, so neither adds bloat.

The path, decided in stages:

1. **Convention only**, as above. Running now.
2. **General improvements** to the board and CLI, each justified by friction logged during the trial. Never "for plans".
3. **A dedicated plan format and view** only if stages 1 and 2 aren't enough. Even then only the format would be promoted, as a pure core subpath read by the board, the way `flag` was. Generating a plan stays outside core, because it is agent-driven work and baking agent workflow into core is a settled non-goal.

## Related

[Explore outcomes and deliverables above individual tasks](spike-explore-outcomes-and-deliverables-above-individual-tasks.md) is a neighbour, not a duplicate. It asks whether a result is ready, which is a question of scope and evidence. This spike asks what order to work in and why. If both end up as convention-level pages that link to tasks, check whether one shape serves both before building either.

## Follow-ups

- [Exclude tasks by tag in task list and search](exclude-tasks-by-tag-in-task-list-and-search.md), created alongside this spike.
- Nothing else until the trial's friction log gives a reason. If it does, write the task from the logged evidence.
