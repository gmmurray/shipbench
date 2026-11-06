---
'@shipbench/core': minor
---

`TaskFrontmatter` gains an optional `related` slug list. `createTask` and `updateTask` reject a self-reference or a slug that matches no live or archived task file, checking only the slugs a write adds. Reads warn on a dangling or malformed value with field `related`.

`listTasks` now lists `tasks/archive/` without reading it, and returns the slugs as `archivedSlugs` on `TaskReadResult`. A `related` link to an archived task is therefore not reported as dangling.

The new `@shipbench/core/related` subpath exports `createRelatedIndex` and `relatedSlugs`. Both are pure, and both are also exported from the main entry. `createRelatedIndex` resolves associations in both directions as `RelatedTask` entries.
