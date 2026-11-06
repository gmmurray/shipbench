---
'@shipbench/board': minor
---

The detail view edits a task's `related` list, and shows associations recorded on other tasks as read-only. Targets it cannot resolve are kept when the list is saved. A host's `listTasks` should return `archivedSlugs` so that archived targets read as archived before the archive view loads. Without it, they read as unresolved.
