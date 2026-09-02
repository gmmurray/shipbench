---
"@shipbench/core": minor
"shipbench": minor
---

Let a Task Update hold ordinary Markdown headings. A line starting a heading at column 0 inside an entry's text — `#` through `######` — made the next read report a malformed Updates section, at every level, including the `####` that reads as plain body text. The write succeeded and the read failed later, so nothing surfaced the problem until someone touched that task's Updates again; by then `task comment`, `comment edit`, and `comment delete` all refused the task while `task get`, `list`, `move`, and `edit` kept working, leaving a board that looked healthy and a file only a hand edit could repair.

Only a `### <ISO 8601 timestamp>` line opens an entry now. A heading whose text starts with a calendar date is still judged as an entry heading, so a hand-written one at the wrong level is caught rather than folded silently into the entry above it; every other heading is prose.

`addComment` and `editComment` now validate entry text before writing, so the CLI can no longer produce a file it will refuse to read. Text carrying its own `## Task Updates` heading, a column-0 heading whose text is a date, or an unclosed code fence is rejected on the command that wrote it. `createTask` and `updateTask` reject a description that leaves a code fence open for the same reason: the fence ran past the end of the description and swallowed the marker below it, hiding every entry from `task get`, the board, and search while the file still held them.

`shipbench task comment` and `shipbench task comment edit` accept `--body <text>` and `--body-file <path>` (`-` reads stdin) in place of the positional text, the same pair `task create` and `task edit` take. `--body-file` is the one to reach for when an update runs to several lines: ShipBench reads the file as UTF-8 itself, so the prose never passes through shell quoting or a shell's encoding.

The CLI now parses each command's options where they are written. An option declared on a parent previously claimed every later occurrence of its flag, which is what kept `task comment edit <slug> <index> --body-file <path>` from reaching its subcommand. The visible consequence elsewhere is that `-C <path>` must precede the subcommand, which is the only place it was ever read.
