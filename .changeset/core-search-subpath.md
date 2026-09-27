---
"@shipbench/core": minor
---

`searchTasks` is now also exported from a new `@shipbench/core/search` subpath. Browser hosts can import it from there without pulling in the package root, which imports `node:fs`.
