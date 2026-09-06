---
title: Add focused dependency queries for a single task
status: todo
priority: medium
tags:
  - cli
  - core
  - dependencies
  - agents
created: '2026-09-06T18:32:58.422Z'
updated: '2026-09-06T18:32:58.422Z'
---

The CLI exposes the full dependency graph, including reverse relationships. Let an agent or human answer a narrower question without reading the entire project: what blocks this task, what lies behind those blockers, and what would this task unblock?

## Decisions before implementation

Choose a small query interface for a named task, direction, and bounded traversal. Distinguish direct neighbors from transitive paths, and distinguish a structural dependent from a task that would become available if this task completed.

Define how missing nodes, cycles, configured completion state, and explicitly requested archived nodes appear. Preserve the existing graph command's behavior and stable machine-readable output.

## Acceptance

- Return the relevant blocking chain or dependents for one task with enough status context to explain it.
- Resolve readiness using the same configured semantics as task list.
- Bound output without silently suggesting a truncated graph is complete.
- Handle malformed or unresolved relationships without looping or hiding the problem.
- Verify useful output on branching dependency examples and document the query.
- Keep contextual links between tasks distinct from dependency edges: a task consulted for rationale is not necessarily a prerequisite.
