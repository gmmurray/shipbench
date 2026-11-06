---
'shipbench': minor
---

`shipbench task graph <slug>` shows the dependency chain around one task instead of the whole graph: what it waits on, what lies behind those blockers, and what finishing it would unblock. `--blockers` and `--dependents` limit it to one side, and `--depth <n>` bounds the walk. When `--depth` cuts a branch, the output says so. Readiness matches `task list --available`, so an archived dependency counts as satisfied with or without `--archived`, which only decides whether the walk continues through archived tasks. Interactive terminals get a tree, and redirected output and `--json` get JSON. `shipbench task graph` with no slug is unchanged.
