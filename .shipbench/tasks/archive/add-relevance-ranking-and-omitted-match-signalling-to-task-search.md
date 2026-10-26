---
title: Add relevance ranking and omitted-match signalling to task search
status: done
priority: medium
tags:
  - cli
  - core
  - search
created: '2026-09-07T19:31:25.589Z'
updated: '2026-09-07T20:08:19.957Z'
---

`task search` currently returns matches in board order (live tasks first, then archived) and `--limit` truncates that list silently. The search contract in [docs/spec.md](../../docs/spec.md) marks this ordering provisional.

Add explicit relevance ranking (weight by matched field, term coverage, recency tiebreak on `updated`) and, when `--limit` drops matches, communicate the omission: a `total_matches` count in JSON and an "N more not shown" line in text output.

Split out from make-cli-search-retrieve-recorded-decisions-with-useful-context, which set the corpus and result-context contract and deferred ordering. Coordinate the ranking with the board-search implementation so both surfaces order results the same way.

Start in [search.ts](../../packages/core/src/search.ts) — `searchTasks` currently preserves input order by design; that contract changes here.

## Task Updates

### 2026-09-07T19:53:39.731Z
Implemented and ready for review.

searchTasks (packages/core/src/search.ts) now ranks instead of preserving input order:
- score = Σ FIELD_WEIGHT[field] × (query terms that field covers / total terms), with FIELD_WEIGHT title:12, tags:6, body:3, updates:2. Title outweighs the sum of the rest, so a title hit always leads.
- tiebreak: more recent `updated` desc, then stable input order (kept as the deterministic final key).
Ranking lives in searchTasks itself so the board-search task inherits identical ordering when it adopts the shared function — it does not use searchTasks yet (getVisibleTasks in boardStore.ts is still the old title/slug/assignee/tag filter), so no board change here.

CLI (apps/cli/src/cli.ts task search):
- JSON gains `total_matches` (count before --limit), always present.
- Text output ends with `… N of M matches not shown (raise --limit)` whenever --limit drops a match, including --limit 0. This replaces the fully-silent --limit 0 output; the existing "suppresses archived header" test was updated to expect the new line (header still suppressed).

Docs: docs/spec.md Search section (Ordering → relevance, new Omitted matches bullet, ranking removed from the staged list), apps/site cli-reference.md task search section + JSON example.

Changeset: .changeset/rank-task-search-results.md (core minor, shipbench minor). Trimmed the now-resolved "relevance ranking staged" line from the prior unreleased search-task-updates changeset.

Tests: 5 new core tests (field weight order, term coverage, recency tiebreak, input-order fallback), 2 new CLI assertions (total_matches, omission line). Full suite green: core 254, cli 268, workspace 730. typecheck + lint clean.
