---
title: Add metadata and availability filters to task search
status: done
priority: medium
tags:
  - cli
  - search
created: '2026-09-07T19:31:25.697Z'
updated: '2026-09-08T22:01:20.834Z'
---

`task search` takes only `--archived` / `--all` / `--limit`. `task list` already has `--status`, `--assignee`, `--priority`, `--tag` (comma or repeated, AND semantics), and `--available` / `--blocked`. An agent narrowing "ready work that mentions X" has to post-filter search output by hand.

Add those same filters to `task search`, reusing `task list`'s predicate and the `listAvailableTasks` / `listBlockedTasks` helpers verbatim. Mirror `task list`'s conflict rules (`--available` excludes `--blocked`; availability is a live-column concept, so it cannot combine with `--archived` / `--all`).

Split out from make-cli-search-retrieve-recorded-decisions-with-useful-context, which set the search corpus and result-context contract and deferred metadata/availability narrowing. The board-search task should keep its existing metadata searches; align flag names and semantics with it.

Start in [CLI search action](../../apps/cli/src/cli.ts) (`task search`), and the filter block in the `task list` action just above it.

## Task Updates

### 2026-09-08T21:59:24.822Z
Implemented on main. `task search` now accepts `--status`, `--assignee`, `--priority`, `--tag`, and `--available`/`--blocked`, reusing `task list`'s predicate and the `listAvailableTasks`/`listBlockedTasks` helpers verbatim. Filters narrow the candidate set before `searchTasks` runs, so relevance ordering is untouched. Conflict rules mirror `task list`: `--available` excludes `--blocked`, and availability cannot combine with `--archived`/`--all` (rejected up front; the archive is still read for dependency resolution when availability is requested without `--archived`).

Scope: CLI-only change — no `@shipbench/core` surface change was needed, so the changeset bumps `shipbench` (minor) alone. Docs updated: spec.md (moved metadata/availability out of "staged"), cli-reference.md, apps/cli/README.md, and the AGENTS scaffold (init.ts) plus the dogfood `.shipbench/AGENTS.md`.
