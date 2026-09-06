---
title: Make CLI search retrieve recorded decisions with useful context
status: todo
priority: high
tags:
  - cli
  - core
  - search
  - agents
created: '2026-09-06T18:32:56.702Z'
updated: '2026-09-06T19:41:24.798Z'
---

The CLI already searches titles, tags, and descriptions. It excludes parsed Task Updates, even though ShipBench encourages recording decisions and pivots there. The owner reports that agents naturally consult related tasks and later retrieve explanations to answer "why did we do this?" Improve that retrieval path.

## Decisions before implementation

Set a coherent search contract covering descriptions, Updates, metadata filters, exact-phrase or whole-word matching, explicit relevance ordering, and source information. Reuse the existing list-filter semantics where applicable. Decide which capabilities belong in this first increment and document any staged follow-up instead of silently widening the task.

A result should identify the task, current status, live/archive location, matching field, and a useful excerpt. An Update match should identify the matching entry and timestamp so the agent can retrieve the source precisely. Decide how limiting results communicates omitted matches. Preserve existing CLI consumers when evolving JSON.

## Acceptance

- Find rationale that appears only in an Update, including an archived source when archive search is explicitly requested.
- Narrow relevant work using established metadata and availability semantics without forcing callers to retrieve entire task bodies.
- Provide predictable control over noisy substring matches and useful ordering for limited results.
- Return enough source context to distinguish recorded reasoning from a new inference. Search itself must not claim an old decision is still current.
- Compare representative rationale questions using a capable agent with filesystem tools, the current CLI, and the improved CLI. Evaluate evidence retrieval, missed relevant records, and output volume.
- Coordinate with the board-search task on shared semantics, preserving its existing metadata searches and deliberate archive boundary.
- Keep lexical retrieval independent of an account or model service. Consider semantic retrieval only if measured misses justify a later investigation.

Start with [search.ts](../../packages/core/src/search.ts), [CLI search](../../apps/cli/src/cli.ts), and [the board-search ticket](make-task-descriptions-discoverable-through-board-search.md).

## Task Updates

### 2026-09-06T19:41:24.798Z
Board review made this task the place where the shared search contract is decided. make-task-descriptions-discoverable-through-board-search now declares depends_on this slug, so the semantics chosen here — description and Updates coverage, matching rules, ordering, and the result context a caller needs to identify a match — are what the board implements afterward rather than deciding in parallel.

That raises the cost of leaving a semantic question open here. Where this task stages a capability for later, say so explicitly in the contract so the board work knows what it is implementing against and what is still undecided.
