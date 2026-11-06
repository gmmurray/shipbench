---
'@shipbench/core': minor
---

`queryTaskDependencies` walks the dependency chain around one task: what it depends on, what depends on it, or both, optionally bounded by `depth`. Readiness follows `listAvailableTasks`, and direct dependents report `unblocks_on_completion` and `waiting_on`. Each slug is expanded once per side, at its shallowest occurrence. A node whose neighbors aren't listed carries `omitted` (`repeat`, `cycle`, or `depth`), and `truncated` reports when `depth` cut a branch. Missing and unreadable dependencies, and a `depends_on` that isn't a list of slugs, are reported rather than dropped. The function is pure and exported from the main entry with its `TaskDependencyQuery*` types.

The `.shipbench/AGENTS.md` that `initProject` writes now describes `shipbench task graph <slug>`. Existing projects keep the file they have.
