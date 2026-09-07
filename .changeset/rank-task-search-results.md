---
"@shipbench/core": minor
"shipbench": minor
---

`task search` now ranks results by relevance instead of returning them in board order. `searchTasks` in `@shipbench/core` scores each match on which fields the query terms landed in — title outweighs tags, tags outweigh the description, the description outweighs Task Updates — scaled by how much of the query each field covers. A more recently `updated` task breaks a score tie, then the caller's input order. The ranking lives in `searchTasks` itself, so the Board inherits the same order when its description-search work adopts the shared function.

`--limit` no longer truncates silently. The CLI's JSON output gains `total_matches` (the count before the limit), and text output ends with a `… N of M matches not shown (raise --limit)` line whenever the limit drops a match, including `--limit 0`.

Still staged to follow-up tasks: metadata and availability filters on `task search`, whole-word and exact-phrase matching, semantic retrieval.
