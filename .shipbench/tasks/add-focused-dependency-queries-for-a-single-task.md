---
title: Add focused dependency queries for a single task
status: review
priority: medium
tags:
  - cli
  - core
  - dependencies
  - agents
created: '2026-09-06T18:32:58.422Z'
updated: '2026-11-06T21:02:13.243Z'
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

## Task Updates

### 2026-11-06T21:02:13.144Z
Settled the open decisions with the owner before implementation:

- **Interface.** `task graph <slug>` extends the existing command, so `task graph` with no slug keeps its output byte-for-byte. `--blockers` / `--dependents` pick a side (both by default) and `--depth <n>` bounds the walk (unbounded by default). The focused flags without a slug are an error.
- **Archived nodes.** The focused query always resolves archive slugs, so an archived dependency is satisfied exactly as in `task list --available`. `--archived` only walks into archived tasks and allows an archived root. The full graph still reports an archived dependency as `missing` without `--archived`. That was deliberately left as it is.
- **"Would unblock".** `unblocks_on_completion` appears on direct dependents only. It is true when the dependent is live, sits in `default_column`, has a well-formed `depends_on`, and this task is its only unsatisfied dependency. `waiting_on` names the rest. It is always false when this task already counts as finished.
- **Bounding.** Each slug is expanded once per side, at its shallowest level. Other occurrences carry `omitted: repeat`, a back-edge carries `omitted: cycle`, and a node cut by `--depth` carries `omitted: depth` and sets `truncated`.
- **Docs.** The CLI reference, the spec, the convention spec, concurrent-agents, and both AGENTS.md copies (this board's and the `init` scaffold) describe the query. Minor changesets are filed for core and the CLI.
