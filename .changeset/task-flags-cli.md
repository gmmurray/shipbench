---
'shipbench': minor
---

Tasks can be flagged for attention without moving them. `shipbench task flag <slug> [reason]` sets a flag with an optional one-line reason, and `shipbench task unflag <slug>` clears it. What a flag means is your project's call. Nothing clears it for you, including moving the task to done.

`task list`, `task search`, and `board terminal` take `--flagged`. Text output from `task list` and `task search` ends a flagged task's line with `— flagged: <reason>`, and `task search --json` adds `flag` to a flagged match. The terminal board marks flagged rows with `!` and counts them on the status line. On the browser board, flagged cards stand out, columns count them, and a header toggle shows only flagged tasks.

`shipbench init` documents flags in the `AGENTS.md` it scaffolds.
