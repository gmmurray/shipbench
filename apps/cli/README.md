# shipbench

**Git-native project management for solo developers.**

Your project plan lives inside your repository as plain Markdown, so Git, your
editor, this CLI, the local board, and your coding agents all work from one
source of truth. No account, no API key, no service.

## Install

```bash
npm install --global shipbench
```

Or run it without installing:

```bash
npx shipbench init
```

## Quickstart

```bash
cd your-repo
shipbench init                          # scaffold .shipbench/
shipbench task create "Build the API"   # create your first task
shipbench task list                     # see the board
shipbench board                         # open the local Kanban board
```

`init` creates a `.shipbench/` directory holding `config.json`, `layout.json`,
a `README.md`, an `AGENTS.md` for coding agents, and a starter task. Commit it
like any other project file. Running `init` on an already-valid project leaves
it byte-for-byte unchanged.

## Commands

| Command | What it does |
| --- | --- |
| `shipbench init` | Create `.shipbench/` when absent. `--name <name>` sets the project name (defaults to the directory basename). |
| `shipbench task create <title>` | Create a task. `--status`, `--priority`, `--assignee`, `--tags=a,b,c`, `--depends-on=slug`, and `--json` to print the created task — the only way to learn a collision-suffixed slug programmatically. |
| `shipbench task list` | List live tasks in board order. Filters: `--status`, `--priority`, `--assignee`, `--tag`, `--available`, `--blocked`, `--archived`. `--json` for machine output. |
| `shipbench task get <slug>` | Retrieve one task as JSON. |
| `shipbench task move <slug>` | `--to=<status>` picks the column; `--top`, `--bottom`, `--before=<slug>`, `--after=<slug>`, `--position=<n>` pick the spot within it. |
| `shipbench task comment <slug> <text>` | Append a timestamped entry to the task's `## Task Updates` section. `edit` and `delete` subcommands take a zero-based index. |
| `shipbench task search <query>` | Case-insensitive search over titles, tags, and bodies. `--archived`, `--all`, `--limit`. |
| `shipbench task graph` | Dependency graph as JSON when piped or with `--json`; an ASCII summary in an interactive terminal. |
| `shipbench task archive <slug>` | Move a task to `tasks/archive/`, byte-identical and restorable. `--done [--keep=N]` bulk-archives completed tasks. |
| `shipbench task unarchive <slug>` | Restore an archived task exactly as it was. |
| `shipbench task delete <slug>` | Delete a task file and prune it from the layout. |
| `shipbench board` | Serve the Kanban board locally, with file watching for live updates. |

Global options: `-C <path>` runs any command against another directory,
`-v, --version`, `-h, --help`.

## Working with coding agents

`shipbench init` writes an `AGENTS.md` into `.shipbench/` describing the board's
conventions, so an agent that reads your repository can operate the board
without extra prompting. Two commands are built for that workflow:

```bash
shipbench task list --available --json   # unblocked, ranked candidates
shipbench task list --blocked            # waiting on dependencies
```

`--available` returns tasks in the default column whose `depends_on` entries are
all complete or archived, ranked by priority then age. Dependencies are data,
not locks — they never gate a write or move a task between columns.

## The `.shipbench/` convention

Tasks are Markdown files with YAML frontmatter:

```markdown
---
title: Setup GitHub OAuth
status: todo
priority: medium
tags: [auth, backend]
created: 2026-06-16T10:00:00Z
updated: 2026-06-16T10:00:00Z
---

Freeform Markdown body.
```

Columns, priorities, and the completion column are configured per project in
`.shipbench/config.json`. Any tool that can read a file can read the board.

## Documentation

- [shipbench.dev/docs](https://shipbench.dev/docs) — quickstart, CLI reference, and recipes
- [Repository](https://github.com/gmmurray/shipbench)

## License

MIT
