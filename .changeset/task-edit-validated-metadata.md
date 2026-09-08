---
"@shipbench/core": minor
"shipbench": minor
---

`shipbench task edit` now revises validated task metadata, not just the description. New flags: `--title` (which never renames the file), `--priority`, `--assignee` / `--clear-assignee`, `--tags` / `--add-tag` / `--remove-tag` / `--clear-tags`, and `--depends-on` / `--add-depends-on` / `--remove-depends-on` / `--clear-depends-on`. Array flags take comma-separated or repeated values; replacement and incremental forms are mutually exclusive, and clearing a field is always its own flag. Every requested change goes through one `updateTask` call, so core's validation runs before any write and a rejected value (an unconfigured priority, a `depends_on` slug with no task file) leaves the task exactly as it was. `status` and board placement stay with `task move`; the Updates section stays with `task comment`.

`core`'s `updateTask` now rejects a `title` with no slug-able character, mirroring `createTask`, rather than writing a task with an empty title.

`task list` and `task search` filters are now consistent: `--status`, `--assignee`, and `--priority` accept a comma-separated or repeated list and match a task whose value is any of the ones listed (`--tag` keeps AND). A `--status` or `--priority` value that is not configured is now an error that names the valid set — previously `task list --status backlog,todo` matched nothing and exited zero. `TaskAvailabilityOptions.status` accepts a list alongside a single id.

Completes `complete-validated-task-metadata-editing-in-the-cli`, including the multi-value filter-flag defect folded into its scope during board review.
