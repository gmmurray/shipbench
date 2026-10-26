---
title: Add whole-word and exact-phrase matching to task search
status: done
priority: medium
tags:
  - cli
  - core
  - search
created: '2026-09-07T19:31:25.804Z'
updated: '2026-09-08T22:14:20.274Z'
---

`task search` matches each whitespace-delimited term as a case-insensitive substring. That makes `ci` match `decision`, `explicit`, and `specific`, and there is no way to search for an exact phrase — quotes only group a query in the shell.

Add opt-in precision controls:
- `--whole-word` — match each term on word boundaries. Substring stays the default.
- exact-phrase `"quoted"` queries — treat a quoted multi-word run as one contiguous match. The corpus and matching are otherwise unchanged.

Split out from make-cli-search-retrieve-recorded-decisions-with-useful-context, which set the search corpus and result-context contract and deferred noise control. The contract in [docs/spec.md](../../docs/spec.md) reserves both as planned. Coordinate the query grammar with the board-search implementation.

Start in [search.ts](../../packages/core/src/search.ts) — term splitting and the substring checks in `searchTasks`.

## Task Updates

### 2026-09-08T22:11:42.271Z
Implemented on main. `searchTasks` in `@shipbench/core` now takes an optional third argument `TaskSearchOptions` (`{ wholeWord?: boolean }`), and the query grammar parses a literal double-quoted run as one contiguous phrase term (internal whitespace matches any whitespace run; empty and unbalanced quotes are dropped). `--whole-word` wraps every term — loose or quoted — in boundary assertions built per-term, so leading/trailing punctuation is handled. Matching moved from `String.includes` to a per-term non-global `RegExp` reused across tasks and fields; `snippetAround` now uses `RegExp.exec` for index and length so a snippet centers on the real match span. Substring, whitespace-delimited matching stays the default.

CLI: `task search` gains `--whole-word`. Exact phrases need the quote characters protected from the shell (`task search '"token exchange"'`) since they are read from the `<query>` argument.

Scope: `@shipbench/core` minor plus `shipbench` minor (changeset added). Docs: spec.md (Search section and flag list; "staged" now names only semantic retrieval), cli-reference.md, apps/cli/README.md, the AGENTS scaffold in init.ts, and the dogfood `.shipbench/AGENTS.md`. The Board inherits the grammar when it adopts `searchTasks` — the coordination point for make-task-descriptions-discoverable-through-board-search.
