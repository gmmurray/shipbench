---
"@shipbench/core": minor
"@shipbench/board": minor
"shipbench": minor
---

A task file whose frontmatter does not parse now shows up everywhere instead of disappearing. A hand edit that repeats a key, such as a second `depends_on:`, makes the YAML invalid. Until now, core dropped that file from every read and left a single warning behind. The Board showed nothing, and `task list --json` returned a `tasks` array that looked complete.

Core now returns the file itself. `TaskReadResult` has a new required `unreadable` array of `UnreadableTaskFile` entries (`slug`, `path`, the whole file verbatim, and a `reason` that names the file line where it can, such as "Duplicated mapping key at line 5."). The `frontmatter` warning is still there. Frontmatter that parses to a list or a bare value, which used to come through as a task with fields named `0` and `1`, is treated the same way. `getTask` and every mutation now throw an exported `UnreadableTaskError` whose message names the task and the file and whose `file` carries the same record. Before, `getTask` threw the raw js-yaml message, which named neither. Hosts that build a `TaskReadResult` themselves must add `unreadable`.

The Board shows these files in an Unreadable column at the leading edge of the board and in the archive view. Each read-only card shows the path, the reason, and the frontmatter exactly as written.

`shipbench task list` and `task search` print each file as an `[unreadable]` line after the tasks, whatever the filters, and their JSON has an `unreadable` array (`--include-body` adds the raw `content`). Both still exit `0`, because the read succeeded and the file is in the output. `task get` on such a file fails with the new message. The terminal board shows an "N unreadable" alert, and the board server answers a write to the file with 422.
