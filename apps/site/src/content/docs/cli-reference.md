---
title: ShipBench CLI Reference
description: Commands, flags, JSON payloads, and agent-oriented query patterns for the ShipBench CLI.
group: Reference
order: 1
updated: 2026-09-02
---

The ShipBench CLI reads and writes the `.shipbench/` project rooted at your current directory, or at the directory selected with the global `-C` option.

```bash
shipbench --help
shipbench --version
shipbench -C ../another-project task list --json
```

Every command documents its own flags:

```bash no-copy
shipbench <command> --help
```

The CLI uses core for validation, slug creation, timestamps, dependency checks, archive safeguards, and layout updates. Humans may edit task files directly; scripts and agents should prefer CLI mutations.

## Global option

```bash no-copy
shipbench [-C <path>] <command>
```

`-C <path>` runs any command as if ShipBench had been started in that directory.
Relative paths resolve against the shell's current directory; absolute paths work
as written. ShipBench exits with an error naming the path when it does not exist
or is not a directory.

The option applies to `init`, `connect`, every `task` subcommand, and `board`.
For `init`, the default project name comes from the selected directory's
basename:

```bash
shipbench -C ../new-project init
```

## Command reference

### `shipbench init`

```bash no-copy
shipbench init [--name <name>] [--harbor <connect-url>]
```

Initializes a new ShipBench project. `--name` defaults to the selected project directory's name.

| Flag | Purpose |
| --- | --- |
| `-n, --name <name>` | Set the project display name. |
| `--harbor <connect-url>` | Initialize safely, then connect the GitHub origin to a Harbor project with a signed URL. |

Initialization creates `config.json`, `layout.json`, `README.md`, `AGENTS.md`, and a welcome task only when the project is absent. A valid existing project remains byte-for-byte unchanged. An incomplete, malformed, or invalid project fails before any write. If you pass `--name` for an existing project, it must match the configured name.

### `shipbench connect`

```bash no-copy
shipbench connect --harbor <connect-url>
```

Connects an initialized project to Harbor without modifying project files. Harbor generates the signed URL; treat it as a short-lived credential and use the complete command Harbor displays.

The command must run at the Git worktree root. It accepts GitHub HTTPS, scp-style SSH, and `ssh://git@github.com/…` origins. Uncommitted or unpushed ShipBench files produce warnings because Harbor reads the remote repository, but they do not block the connection.

Use `shipbench init --harbor <connect-url>` when the local repository still needs ShipBench. Use `shipbench connect --harbor <connect-url>` when it is already initialized.

### `shipbench task create`

```bash no-copy
shipbench task create <title> [options]
```

Creates a task, generates a collision-safe slug, and sets both timestamps.

| Flag | Purpose |
| --- | --- |
| `-s, --status <status>` | Initial column; defaults to `default_column`. |
| `-a, --assignee <assignee>` | Freeform informational label. |
| `-p, --priority <priority>` | Configured priority value. |
| `-t, --tags <tags>` | Comma-separated tags. |
| `-d, --depends-on <slugs>` | Comma-separated dependency slugs; may be repeated. |
| `--body <text>` | Description as Markdown text. |
| `--body-file <path>` | Read the description from a UTF-8 file; `-` reads stdin. |

```bash
shipbench task create "Build API" \
  --status todo \
  --priority high \
  --tags backend,api \
  --depends-on choose-database \
  --depends-on define-schema
```

`--body` and `--body-file` are mutually exclusive, and a task created without
either has an empty description.

Prefer `--body-file` for anything longer than a sentence. It reads the file as
UTF-8 directly, so the description never passes through shell quoting or a
shell's encoding. That is what makes it the reliable path on Windows, where
PowerShell 5.1 decodes UTF-8 as Windows-1252 and corrupts every non-ASCII
character in a quoted argument and in a pipe alike.

```bash
shipbench task create "Build API" --body-file plan.md
shipbench task create "Build API" --body "Cursor pagination, no offsets."
```

### `shipbench task edit`

```bash no-copy
shipbench task edit <slug> (--body <text> | --body-file <path>) [--json]
```

Replaces a task's Markdown description and updates its `updated` timestamp.
`created` is never touched, and the trailing `## Task Updates` section is left
exactly as it was — use [`shipbench task comment`](#shipbench-task-comment) for
those.

The description is replaced whole; there is no append. An empty value clears it:

```bash
shipbench task edit build-api --body-file revised-plan.md
shipbench task edit build-api --body ""
```

A description may not contain a `## Task Updates` heading of its own — that
heading is what divides the description from the entries below it, so the write
is rejected rather than filing part of the description as Updates. Put the
heading in a code fence when a description means it literally. A description may
not leave a code fence open either: the fence would run past the end of the
description and swallow the marker, hiding every entry from the next read. See
[Task Updates](/docs/convention-spec/#task-updates).

`--json` emits the edited task in the same shape as
[`shipbench task get`](#shipbench-task-get).

### `shipbench task move`

```bash no-copy
shipbench task move <slug> [--to <status>] [placement]
```

Moves a task to a configured column and updates its `updated` timestamp. The move appends the task to the destination's manual layout unless the destination is `done_column`, which uses time ordering.

`depends_on` does not gate moves. It describes readiness; it is not a lock.

A placement flag says where in the destination column the task lands. They are mutually exclusive:

| Flag              | Places the task                                       |
| ----------------- | ----------------------------------------------------- |
| `--top`           | First in the column                                   |
| `--bottom`        | Last in the column                                    |
| `--before <slug>` | Immediately before another task in the same column    |
| `--after <slug>`  | Immediately after another task in the same column     |
| `--position <n>`  | At a 0-based index; `-1` appends                      |

Prefer the anchors. `--before build-api` states an intent, while an index depends on what the column happens to look like right now.

With a placement flag, `--to` is optional and defaults to the task's current column, which is how you reorder without moving:

```bash
shipbench task move build-api --before ship-auth
shipbench task move ship-auth --to in-progress --top
```

An in-column reorder writes only `layout.json` — the task file, including its `updated` timestamp, is untouched.

Placement flags cannot target `done_column`; it is always sorted by `updated` desc and carries no manual order. An anchor that is unknown, archived, in another column, or the task itself is an error.

### `shipbench task comment`

```bash no-copy
shipbench task comment <slug> (<text> | --body <text> | --body-file <path>)
```

Appends a timestamped entry to the trailing `## Task Updates` section and updates the task timestamp. Quote text that contains spaces:

```bash
shipbench task comment build-api \
  "Switched to cursor pagination after the load test."
```

An update longer than a sentence takes the same `--body-file` that
[`shipbench task create`](#shipbench-task-create) does, and for the same reason —
the file is read as UTF-8 and the prose never passes through shell quoting or a
shell's encoding:

```bash
shipbench task comment build-api --body-file update.md
```

The text may be given once, positionally or through an option, never both.

An entry's text is prose, and Markdown headings inside it are yours to use. Only
a `### <ISO 8601 timestamp>` line at the start of a line opens a new entry, so a
`## Rollback plan` written in an update stays part of that update. Three things
are refused on write, because the next read would file them as structure: a
`## Task Updates` heading of its own, a line-initial heading whose text is a
date, and an unclosed code fence.

See [Task Updates](/docs/convention-spec/#task-updates) for the time-anchored-fact heuristic.

Edit only an entry's text with its zero-based index:

```bash no-copy
shipbench task comment edit <slug> <index> (<text> | --body <text> | --body-file <path>)
```

ShipBench preserves the entry timestamp and updates the task timestamp:

```bash
shipbench task comment edit build-api 0 \
  "Kept cursor pagination after the second load test."
```

Delete an entry with the same index:

```bash no-copy
shipbench task comment delete <slug> <index>
```

Deleting shifts every entry below it up one index:

```bash
shipbench task comment delete build-api 0
```

Git keeps prior text and deleted entries in file history.

### `shipbench task get`

```bash no-copy
shipbench task get <slug> [--archived]
```

Returns one task as JSON. The payload always includes full frontmatter, the Markdown description, and parsed Updates:

```json
{
  "slug": "build-api",
  "status": "in-progress",
  "frontmatter": {
    "title": "Build API",
    "status": "in-progress",
    "priority": "high",
    "tags": ["backend", "api"],
    "depends_on": ["define-schema"],
    "created": "2026-07-21T03:49:00.000Z",
    "updated": "2026-07-24T20:00:00.000Z"
  },
  "body": "Implement the project API.",
  "comments": [
    {
      "timestamp": "2026-07-24T20:00:00.000Z",
      "text": "Switched to cursor pagination after the load test."
    }
  ]
}
```

If the slug is archived, the live lookup tells you to retry with `--archived`.

When a task's Updates section cannot be parsed, `body` still holds only the
description. The section is preserved verbatim under `unreadable_updates`, with
the reason it would not parse, and a warning naming the offending line goes to
stderr so a piped `--json` read stays clean:

```json
"comments": [],
"unreadable_updates": {
  "text": "## Task Updates\n\n#### 2026-07-25T09:30:00.000Z\nWrong level.",
  "reason": "expected each entry heading to use \"### <ISO 8601 timestamp>\", saw \"#### 2026-07-25T09:30:00.000Z\"."
}
```

The section is written back byte-identical on every write, so nothing is lost
while it stays broken. Repair it by fixing the named line in the task file;
`task comment` refuses the task until it parses. See
[Task Updates](/docs/convention-spec/#task-updates).

For agents, `task get` is the preferred second step after a body-free `task list --available --json` shortlist.

### `shipbench task list`

```bash no-copy
shipbench task list [options]
```

Lists live tasks in board order. Configured columns follow `config.columns`; tasks within each column follow the Board's visible order. Uncategorized tasks come last. Archived listings retain archive order.

| Flag | Purpose |
| --- | --- |
| `-s, --status <status>` | Filter by exact status. |
| `-a, --assignee <assignee>` | Filter by exact assignee. |
| `-p, --priority <priority>` | Filter by exact priority. |
| `--tag <tag>` | Filter by tag; comma-separated or repeatable. Multiple values use AND semantics. Matching is case-insensitive. |
| `--available` | Return tasks in the actionable column whose dependencies are satisfied. |
| `--blocked` | Return tasks in the actionable column with at least one unsatisfied dependency. |
| `--limit <n>` | Return at most `n` tasks. `0` returns none. |
| `--archived` | List archived tasks instead of live tasks. |
| `--json` | Emit machine-readable JSON. |
| `--include-body` | With `--json`, add each description and parsed Updates. |

Ordinary filters combine with AND semantics:

```bash
shipbench task list --status todo --priority high --tag backend --json
shipbench task list --tag backend --tag auth --json
shipbench task list --tag backend,auth --json
```

#### Available and blocked work

`--available` and `--blocked` use `config.default_column` unless you pass `--status`. A dependency is satisfied when the referenced task is in `done_column` or in the archive.

```bash
shipbench task list --available --json
shipbench task list --available --status backlog --tag research --json
shipbench task list --blocked --json
```

Availability results sort by configured priority, then oldest `created` timestamp, then slug. Use that order to choose what to inspect next; plain `task list` order describes where tasks appear on the board. A task can therefore appear first in its column and third in the availability results. With `--json`, read the array order for availability rank and each task's `position` for board placement. ShipBench does not assign work.

`--available` and `--blocked` conflict with each other. Neither can be combined with `--archived`.

#### JSON output

Without `--include-body`, JSON remains compact:

```json
{
  "tasks": [
    {
      "slug": "build-api",
      "title": "Build API",
      "status": "todo",
      "priority": "high",
      "tags": ["backend"],
      "depends_on": [],
      "position": 0,
      "created": "2026-07-21T03:49:00.000Z",
      "updated": "2026-07-21T03:49:00.000Z"
    }
  ],
  "warnings": []
}
```

`position` is zero-based within the task's column and is computed before filters or availability ranking. `--include-body` adds `body` and `comments` to each task. `--archived --json` adds `"archived": true` at the top level and omits `position` because archived tasks have no board placement.

### `shipbench task search`

```bash no-copy
shipbench task search <query> [options]
```

Search splits the query on whitespace and treats each term as a case-insensitive substring. Every term must appear somewhere in the task's title, tags, or Markdown description; terms may appear in different fields and in any order. Parsed Task Updates are separate from the description and are not part of the search text.

Quotes only keep a multi-word query together in the shell; ShipBench does not support exact-phrase search.

| Flag | Purpose |
| --- | --- |
| `--archived` | Search only archived tasks. |
| `--all` | Search live and archived tasks. |
| `--limit <n>` | Return at most `n` matches. `0` returns none. |
| `--json` | Emit machine-readable JSON. |
| `--include-body` | With `--json`, add each complete matching description. |

`--archived` and `--all` are mutually exclusive.

```bash
shipbench task search "oauth" --json
shipbench task search "migration" --all --json
shipbench task search "error handling" --json --include-body --limit 5
```

JSON describes where each match occurred and includes a body snippet when applicable:

```json
{
  "matches": [
    {
      "slug": "setup-oauth",
      "title": "Setup OAuth",
      "matched_fields": ["title", "body"],
      "snippet": "Implement the OAuth callback and token exchange."
    }
  ],
  "warnings": []
}
```

### `shipbench task graph`

```bash no-copy
shipbench task graph [--archived] [--json]
```

Builds the dependency DAG for live tasks. `--archived` includes archived tasks as nodes, which resolves archived dependencies to the `archived` status instead of `missing`.

Interactive terminals receive a readable tree. Redirected output becomes JSON automatically; agents and scripts should pass `--json` explicitly for a stable request.

```json
{
  "define-schema": {
    "status": "done",
    "depends_on": [],
    "blocks": ["build-api"]
  },
  "build-api": {
    "status": "todo",
    "depends_on": ["define-schema"],
    "blocks": []
  }
}
```

Referenced slugs that cannot be resolved appear as nodes with `"status": "missing"`.

### `shipbench task archive`

Archive one task:

```bash no-copy
shipbench task archive <slug> [--force]
```

Archive older completed tasks in bulk:

```bash no-copy
shipbench task archive --done [--keep <count>]
```

| Flag | Purpose |
| --- | --- |
| `--force` | Archive one non-done task even when live tasks depend on it. |
| `--done` | Select older tasks from `done_column` for bulk archiving. |
| `--keep <count>` | Keep this many most-recent done tasks live. Valid only with `--done`. |

A non-done task with live dependents is blocked unless you pass `--force`. Done tasks and tasks without live dependents archive without that flag.

Bulk archiving keeps `done_display.max` recent tasks by default. If that cap is disabled, the default bulk operation keeps all done tasks. Pass `--keep 0` to archive every done task deliberately.

`--done` can move many files at once. Agents should run the bulk form only when the user explicitly requests it.

### `shipbench task unarchive`

```bash no-copy
shipbench task unarchive <slug>
```

Restores an archived task byte-for-byte to `tasks/`. Slugs are unique across live and archived tasks, so a valid archive cannot collide with a new live task.

### `shipbench task delete`

```bash no-copy
shipbench task delete <slug>
```

Deletes a live task. This is an irreversible filesystem operation; use Git to recover committed content. Prefer archiving when you may need the task later.

### `shipbench board`

```bash
shipbench board             # the browser board
shipbench board web         # the same thing, explicitly named
shipbench board terminal    # a read-only live view in this terminal
```

`board` has two surfaces. Bare `board` opens the browser one and stays an alias for `board web`; the two share no flags, which is why they are subcommands rather than a mode flag.

#### `shipbench board web`

```bash no-copy
shipbench board web [--port <number>] [--no-open]
```

Starts the local Board UI with real-time file watching.

| Flag | Purpose |
| --- | --- |
| `--port <number>` | Preferred port, from `1` through `65535`; defaults to `4321`. |
| `--no-open` | Start the server without opening a browser. |

The server binds to `127.0.0.1`. If the preferred port is occupied, it tries the next nine ports and prints the selected URL.

#### `shipbench board terminal`

```bash no-copy
shipbench board terminal [-s <statuses>] [--tag <tag>] [-a <assignee>] [-p <priority>]
```

Renders the board in the terminal and repaints it as files change. Aliases: `term`, `tui`.

It is **read-only and takes no keyboard input** — Ctrl-C exits, nothing else is bound, and it never writes to `.shipbench/`. It is built to be left open in a pane while you or an agent work in another.

| Flag | Purpose |
| --- | --- |
| `-s, --status <statuses>` | Comma-separated column ids to render; defaults to every configured column. Unlike `task list --status`, this accepts several. |
| `--tag <tag>` | Comma-separated or repeatable, with AND semantics. |
| `-a, --assignee <assignee>` | Exact match. |
| `-p, --priority <priority>` | Exact match. |

`--status` chooses which columns render; the other three filter tasks inside them, and while any of them is active every column header reads `shown/total`.

The board replaces the current terminal screen while it runs and restores it on exit. It adapts to narrow terminals, and widening the window never shows you less. Tasks whose `status` matches no configured column remain visible under `UNCATEGORIZED`.

You can edit task files while the board is open. If it cannot load the project at startup, it tells you why. Once it is running, a broken config or failed read leaves the last good board on screen and adds a warning to the status line.

The terminal board marks a task with unfinished dependencies by replacing the priority meter's separator with a warning mark: `››·!Blocked task`. In narrower columns, where the meter is hidden, the row starts with `!`. Archived dependencies count as satisfied, even when an archived file is malformed; malformed prerequisites add a warning instead of a blocked marker. The view rereads the archive after project changes, so archiving or unarchiving a dependency updates the marker without a restart.

With stdout redirected it prints one plain 80×24 frame and exits, so `shipbench board terminal > board.txt` and piping into a log both do something useful. `NO_COLOR` drops styling; the priority meter distinguishes its tiers by character (`›››` / `››·` / `›··`), and blocked tasks retain the literal `!`, so both signals survive without colour.

**Terminal support.** Any terminal with the usual VT support works; Windows Terminal on Windows 11 is the verified baseline. Legacy Windows `conhost` is out of scope: the view depends on the alternate screen buffer and Unicode box-drawing, which it does not handle the same way.

## Agent query workflow

Agents get the best balance of context and token use from a staged read:

```bash no-copy
# 1. Find unblocked candidates without descriptions.
shipbench task list --available --json --limit 10

# 2. Load one selected task completely.
shipbench task get <slug>

# 3. Search or inspect the graph only when the task needs more context.
shipbench task search "<term>" --all --json
shipbench task graph --archived --json
```

Use `--include-body` for bulk analysis, not routine selection. This keeps the first query predictable and small while preserving complete context on demand.
