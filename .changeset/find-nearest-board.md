---
'shipbench': minor
---

Commands now find the nearest board at or above the current directory, the way `git` finds its repository. `shipbench task list` from `src/` reads the board at the project root instead of failing with a raw `ENOENT`. The search stops at the first `.shipbench/` directory and at the top of the Git checkout, including a linked worktree, so it never reaches another checkout's board. When the board was found above the current directory, commands that change a task print `Using .shipbench/ from <path>` on stderr; stdout and `--json` output are unchanged.

`-C <path>` still names a board exactly and never searches. `init` still creates its board where it runs, and now notes when a board already exists above it in the same checkout. With no board found, every command prints `No .shipbench/config.json found ... Run shipbench init first.`, naming where it looked.
