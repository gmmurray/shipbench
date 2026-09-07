---
"@shipbench/core": minor
"shipbench": minor
---

`task search` now retrieves recorded decisions. The search corpus gains **Task Updates**: every parsed entry, plus a quarantined unreadable section, alongside the title, tags, and description it already covered. A pivot or rationale recorded only in an Update — the place ShipBench tells you to record it — is now findable with the one command built for that.

`searchTasks` in `@shipbench/core` is now the shared lexical retrieval contract; the Board implements the same semantics next. Each `TaskSearchMatch` carries more source context so a caller can act on a hit without loading the whole task:

- `status` — the task's current column, so an Update match reads as a record, not a claim that the decision still stands.
- `matched_fields` may now include `"updates"` (additive to the `title` / `tags` / `body` set).
- `update_matches` — present when an Update matched. A readable entry gives its zero-based `index`, ISO `timestamp`, and an excerpt, so the source is retrievable exactly; an unreadable section gives `{ unreadable: true, snippet }`.

The CLI adds `location` (`"live"` / `"archive"`) to every JSON match and prints `[live · in-progress]` and `↳ update N (timestamp): …` lines in text mode. `--include-body` now also attaches `comments` so an Update hit resolves in one call. Search output never labels a match "current" or "decided".

Deliberately staged to follow-up tasks, not in this change: relevance ranking and an omitted-match signal for `--limit`; metadata and availability filters on `task search`; whole-word and exact-phrase matching; semantic retrieval. Ordering stays board-order-then-archived and `--limit` still truncates silently.
