---
title: Add whole-word and exact-phrase matching to task search
status: todo
priority: medium
tags:
  - cli
  - core
  - search
created: '2026-09-07T19:31:25.804Z'
updated: '2026-09-07T19:31:25.804Z'
---

`task search` matches each whitespace-delimited term as a case-insensitive substring. That makes `ci` match `decision`, `explicit`, and `specific`, and there is no way to search for an exact phrase — quotes only group a query in the shell.

Add opt-in precision controls:
- `--whole-word` — match each term on word boundaries. Substring stays the default.
- exact-phrase `"quoted"` queries — treat a quoted multi-word run as one contiguous match. The corpus and matching are otherwise unchanged.

Split out from make-cli-search-retrieve-recorded-decisions-with-useful-context, which set the search corpus and result-context contract and deferred noise control. The contract in [docs/spec.md](../../docs/spec.md) reserves both as planned. Coordinate the query grammar with the board-search implementation.

Start in [search.ts](../../packages/core/src/search.ts) — term splitting and the substring checks in `searchTasks`.
