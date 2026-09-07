---
title: Add metadata and availability filters to task search
status: todo
priority: medium
tags:
  - cli
  - search
created: '2026-09-07T19:31:25.697Z'
updated: '2026-09-07T19:31:25.697Z'
---

`task search` takes only `--archived` / `--all` / `--limit`. `task list` already has `--status`, `--assignee`, `--priority`, `--tag` (comma or repeated, AND semantics), and `--available` / `--blocked`. An agent narrowing "ready work that mentions X" has to post-filter search output by hand.

Add those same filters to `task search`, reusing `task list`'s predicate and the `listAvailableTasks` / `listBlockedTasks` helpers verbatim. Mirror `task list`'s conflict rules (`--available` excludes `--blocked`; availability is a live-column concept, so it cannot combine with `--archived` / `--all`).

Split out from make-cli-search-retrieve-recorded-decisions-with-useful-context, which set the search corpus and result-context contract and deferred metadata/availability narrowing. The board-search task should keep its existing metadata searches; align flag names and semantics with it.

Start in [CLI search action](../../apps/cli/src/cli.ts) (`task search`), and the filter block in the `task list` action just above it.
