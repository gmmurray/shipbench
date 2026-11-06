---
'shipbench': minor
---

`shipbench task list`, `shipbench task search`, and `shipbench board terminal` take `--exclude-tag`. It leaves out any task carrying one of the listed tags, so `task list --available --exclude-tag plan` returns ready work without the tasks that aren't work items. It takes comma-separated or repeated values, matches case-insensitively, and combines with every other filter. Unlike `--tag`, which keeps tasks carrying every listed tag, one match is enough to drop a task.

The `.shipbench/AGENTS.md` that `shipbench init` writes now describes the flag. Existing projects keep the file they have.
