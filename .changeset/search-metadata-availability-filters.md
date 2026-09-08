---
"shipbench": minor
---

`task search` now takes `task list`'s own filters: `--status`, `--assignee`, `--priority`, `--tag` (comma-separated or repeated, AND semantics), and `--available` / `--blocked`. They narrow the candidate set before the search runs, so "ready work that mentions X" is one command instead of a search whose output you filter by hand.

The filters reuse `task list`'s predicate and the `listAvailableTasks` / `listBlockedTasks` helpers verbatim, so semantics match exactly — `--available` / `--blocked` rank on `config.default_column` unless `--status` overrides it, and an archived dependency counts as satisfied. `--available` excludes `--blocked`, and availability is a live-column concept that cannot combine with `--archived` / `--all`. Filtering never changes the relevance ordering; it only decides which tasks are searched.

This completes the metadata/availability narrowing that `make-cli-search-retrieve-recorded-decisions-with-useful-context` deferred. Still staged: whole-word and exact-phrase matching, semantic retrieval.
