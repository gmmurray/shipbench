---
'@shipbench/core': minor
---

`TaskFrontmatter` has an optional `flag` field: a one-line reason, or `true`. `createTask` and `updateTask` reject a blank or multi-line reason and any other value. `updateTask` clears the flag when `flag` is present and `undefined`. Reads return any other value as unflagged, with a `flag` validation warning.

`taskFlag(task)` returns `{ reason }` or `null`, and `isTaskFlagged(task)` returns a boolean. Both are exported from the package root and from a new `@shipbench/core/flag` subpath that a browser host can import without pulling in `node:fs`.
