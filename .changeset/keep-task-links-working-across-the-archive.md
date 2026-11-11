---
'shipbench': minor
'@shipbench/board': minor
---

`shipbench task archive` now warns when live tasks link to the task it archives. The warning names those tasks and where the archived file is now. Archiving still goes ahead, and nothing is rewritten. A bulk `task archive --done` skips links between tasks archived in the same run, since those still resolve.

The board now opens a linked task from a bare link such as `[the decision](choose-a-store.md)`, which is how most task bodies link to each other. Before, it only recognised `./choose-a-store.md`. A link to a task that has been archived now points at its file in `tasks/archive/`, and a link that names the archive opens the task if it has been restored.

The `.shipbench/AGENTS.md` that `shipbench init` writes now recommends recording a linked task in `related` as well, because a slug keeps resolving after either task is archived. Existing projects keep the file they have.
