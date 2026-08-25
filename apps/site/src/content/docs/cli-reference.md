---
title: ShipBench CLI Reference
description: Commands, flags, JSON payloads, and agent-oriented query patterns for the ShipBench CLI.
group: Reference
order: 1
updated: 2026-08-08
---

The ShipBench CLI reads and writes the `.shipbench/` project rooted at your current directory, or at the directory selected with the global `-C` option.

```bash
shipbench --help
shipbench --version
shipbench -C ../another-project task list --json
shipbench <command> --help
```

The CLI uses core for validation, slug creation, timestamps, dependency checks, archive safeguards, and layout updates. Humans may edit task files directly; scripts and agents should prefer CLI mutations.

## Global option

```bash
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

```bash
shipbench init [--name <name>] [--harbor <connect-url>]
```

Initializes a new ShipBench project. `--name` defaults to the selected project directory's name.

| Flag | Purpose |
| --- | --- |
| `-n, --name <name>` | Set the project display name. |
| `--harbor <connect-url>` | Initialize safely, then connect the GitHub origin to a Harbor project with a signed URL. |

Initialization creates `config.json`, `layout.json`, `README.md`, `AGENTS.md`, and a welcome task only when the project is absent. A valid existing project remains byte-for-byte unchanged. An incomplete, malformed, or invalid project fails before any write. If you pass `--name` for an existing project, it must match the configured name.

### `shipbench connect`

```bash
shipbench connect --harbor <connect-url>
```

Connects an initialized project to Harbor without modifying project files. Harbor generates the signed URL; treat it as a short-lived credential and use the complete command Harbor displays.

The command must run at the Git worktree root. It accepts GitHub HTTPS, scp-style SSH, and `ssh://git@github.com/…` origins. Uncommitted or unpushed ShipBench files produce warnings because Harbor reads the remote repository, but they do not block the connection.

Use `shipbench init --harbor <connect-url>` when the local repository still needs ShipBench. Use `shipbench connect --harbor <connect-url>` when it is already initialized.

### `shipbench task create`

```bash
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

```bash
shipbench task create "Build API" \
  --status todo \
  --priority high \
  --tags backend,api \
  --depends-on choose-database \
  --depends-on define-schema
```

### `shipbench task move`

```bash
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

```bash
shipbench task comment <slug> <text>
```

Appends a timestamped entry to the trailing `## Task Updates` section and updates the task timestamp. Quote text that contains spaces:

```bash
shipbench task comment build-api \
  "Switched to cursor pagination after the load test."
```

See [Task Updates](/docs/convention-spec#task-updates) for the time-anchored-fact heuristic.

Edit only an entry's text with its zero-based index. ShipBench preserves the entry timestamp and updates the task timestamp:

```bash
shipbench task comment edit <slug> <index> <text>
shipbench task comment edit build-api 0 \
  "Kept cursor pagination after the second load test."
```

Delete an entry with the same index:

```bash
shipbench task comment delete <slug> <index>
shipbench task comment delete build-api 0
```

Git keeps prior text and deleted entries in file history.

### `shipbench task get`

```bash
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

For agents, `task get` is the preferred second step after a body-free `task list --available --json` shortlist.

### `shipbench task list`

```bash
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

Availability results sort by configured priority, then oldest `created` timestamp, then slug. The order suggests what to inspect first; ShipBench does not assign work. In JSON, `position` still reports the task's board position rather than its rank in these results.

This ranking ignores manual board placement, so it can disagree with the order a plain `shipbench task list` returns — a task sitting first in its column may come back third under `--available`. That is expected, not a bug: the two answer different questions, and ShipBench does not treat either as the authoritative one. Both are available from a single `--available --json` call, since every result still carries its board `position`.

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

```bash
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

```bash
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

```bash
shipbench task archive <slug> [--force]
```

Archive older completed tasks in bulk:

```bash
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

```bash
shipbench task unarchive <slug>
```

Restores an archived task byte-for-byte to `tasks/`. Slugs are unique across live and archived tasks, so a valid archive cannot collide with a new live task.

### `shipbench task delete`

```bash
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

```bash
shipbench board web [--port <number>] [--no-open]
```

Starts the local Board UI with real-time file watching.

| Flag | Purpose |
| --- | --- |
| `--port <number>` | Preferred port, from `1` through `65535`; defaults to `4321`. |
| `--no-open` | Start the server without opening a browser. |

The server binds to `127.0.0.1`. If the preferred port is occupied, it tries the next nine ports and prints the selected URL.

#### `shipbench board terminal`

```bash
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

The board takes over the screen while it runs and restores what was there on exit. As the terminal narrows it degrades in fixed steps — the done column collapses to a count on the status line, then empty columns do, then columns give way to full-width stacked sections — so widening the window never shows you less. Tasks whose `status` matches no configured column are never dropped; they collect in an `UNCATEGORIZED` column that no step collapses.

The first read is allowed to fail, because there is nothing to show yet. Every read after it is not: a broken `config.json` or a storage error keeps the last good frame on screen and puts a warning on the status line. A task file caught mid-write is not fatal at all — the board repaints normally and the file's problem shows up as a warning count instead.

The terminal board marks a task with unfinished dependencies by replacing the priority meter's separator with a warning mark: `››·!Blocked task`. In narrower columns, where the meter is hidden, the row starts with `!`. Archived dependencies count as satisfied, even when an archived file is malformed; malformed prerequisites add a warning instead of a blocked marker. The view rereads the archive after project changes, so archiving or unarchiving a dependency updates the marker without a restart.

With stdout redirected it prints one plain 80×24 frame and exits, so `shipbench board terminal > board.txt` and piping into a log both do something useful. `NO_COLOR` drops styling; the priority meter distinguishes its tiers by character (`›››` / `››·` / `›··`), and blocked tasks retain the literal `!`, so both signals survive without colour.

**Terminal support.** Any terminal with the usual VT support works; Windows Terminal on Windows 11 is the verified baseline. Legacy Windows `conhost` is out of scope: the view depends on the alternate screen buffer and Unicode box-drawing, which it does not handle the same way.

## Agent query workflow

Agents get the best balance of context and token use from a staged read:

```bash
# 1. Find unblocked candidates without descriptions.
shipbench task list --available --json --limit 10

# 2. Load one selected task completely.
shipbench task get <slug>

# 3. Search or inspect the graph only when the task needs more context.
shipbench task search "<term>" --all --json
shipbench task graph --archived --json
```

Use `--include-body` for bulk analysis, not routine selection. This keeps the first query predictable and small while preserving complete context on demand.
