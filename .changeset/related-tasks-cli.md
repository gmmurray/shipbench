---
'shipbench': minor
---

Tasks can point at related work without depending on it. The optional `related` field lists other tasks' slugs, live or archived. It never affects `--available`, `--blocked`, archiving, or `task graph`.

`task create` takes `--related`. `task edit` takes `--related`, `--add-related`, `--remove-related`, and `--clear-related`, applied in the same validated write as the other edits. Removing a link that the other task's file records is rejected, and the error names the task to edit.

`task list --json` adds `related` and `related_tasks` to each task, and `task search --json` adds `related_tasks` to each match. `related_tasks` covers both directions and gives each target's title, status, and whether it is archived. The board's detail view edits the field and shows associations recorded on other tasks as read-only.

**Breaking:** scripts that compare `task list` or `task search` JSON objects exactly will see the new keys.

The `.shipbench/AGENTS.md` that `shipbench init` writes now describes the field. Existing projects keep the file they have.
