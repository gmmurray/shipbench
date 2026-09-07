---
title: Add relevance ranking and omitted-match signalling to task search
status: todo
priority: medium
tags:
  - cli
  - core
  - search
created: '2026-09-07T19:31:25.589Z'
updated: '2026-09-07T19:31:25.589Z'
---

`task search` currently returns matches in board order (live tasks first, then archived) and `--limit` truncates that list silently. The search contract in [docs/spec.md](../../docs/spec.md) marks this ordering provisional.

Add explicit relevance ranking (weight by matched field, term coverage, recency tiebreak on `updated`) and, when `--limit` drops matches, communicate the omission: a `total_matches` count in JSON and an "N more not shown" line in text output.

Split out from make-cli-search-retrieve-recorded-decisions-with-useful-context, which set the corpus and result-context contract and deferred ordering. Coordinate the ranking with the board-search implementation so both surfaces order results the same way.

Start in [search.ts](../../packages/core/src/search.ts) — `searchTasks` currently preserves input order by design; that contract changes here.
