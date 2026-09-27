---
"@shipbench/core": minor
"@shipbench/board": minor
---

Board search now finds tasks by their descriptions and Task Updates, not only their titles, slugs, assignees, and tags. A phrase you remember from a task's reasoning is enough to find it on the board, as it already was with `shipbench task search`.

The Board calls the same `searchTasks` the CLI uses, so a query means the same thing in both: every term, or double-quoted phrase, must appear somewhere in the task. The board also matches each card's slug and assignee, as it did before. When a term appears only in a task's content, the card shows where it was found: a description snippet, or a matching Update's excerpt with its timestamp, plus a count of any other matching Updates. Search still hides cards without reordering them, so each column keeps its own order. The zero-result state now lists what search covers. The archive view's filter uses the same search over the archive it has already loaded.

`@shipbench/core` adds a pure `@shipbench/core/search` subpath exporting `searchTasks`, so browser hosts can import it without pulling in the package root, which imports `node:fs`.
