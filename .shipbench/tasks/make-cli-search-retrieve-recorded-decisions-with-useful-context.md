---
title: Make CLI search retrieve recorded decisions with useful context
status: done
priority: high
tags:
  - cli
  - core
  - search
  - agents
created: '2026-09-06T18:32:56.702Z'
updated: '2026-09-07T19:43:42.830Z'
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

### 2026-09-07T19:41:58.188Z
Shipped the corpus + result-context half of the contract; deferred the rest by explicit decision.

In this increment: `searchTasks` now searches Task Updates entries and a quarantined unreadable section; each match carries `status`, `location` (CLI-supplied), `matched_fields` (may include `updates`), and `update_matches` (readable entry -> index + timestamp + excerpt; unreadable -> `{ unreadable: true, snippet }`). CLI JSON and text output updated; `--include-body` also attaches `comments`. `@shipbench/core` + `shipbench` minor.

Deferred to dedicated follow-up tasks (owner chose the minimal increment):
- add-relevance-ranking-and-omitted-match-signalling-to-task-search
- add-metadata-and-availability-filters-to-task-search
- add-whole-word-and-exact-phrase-matching-to-task-search
So the ticket's acceptance points on metadata/availability narrowing, noise control, and result ordering are recorded-as-staged, not met here. Ordering stays board-order-then-archived; `--limit` still truncates silently.

Contract now lives in docs/spec.md ("Search" under the CLI section) + cli-reference.md. Left a coordination Update on make-task-descriptions-discoverable-through-board-search pointing at it.

Evaluation (docs/audits/cli-search-rationale-retrieval.md): a capable agent answered 3 rationale questions under filesystem-only / old-CLI / new-CLI. New CLI surfaces all three rationales inline in one `task search` with entry index+timestamp; old CLI's search is structurally blind to Updates. Only measured gap: `task search` still indexes only task files, so an audit doc holding Q3's fullest argument stays out of reach. Conclusion: ship; consider widening the lexical corpus to docs/ and .changeset/ later; no semantic-retrieval investigation warranted.
