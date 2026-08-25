# shipbench — ShipBench Project Board

This directory contains the ShipBench project board for **shipbench**. Everything lives in Git alongside your code — no external service required.

## Structure

- `config.json` — Human-owned board configuration (columns, priorities, schema)
- `layout.json` — Machine-managed manual task ordering
- `tasks/` — Individual task files as Markdown with YAML frontmatter
- `tasks/archive/` — Archived task files, kept byte-for-byte for later restore
- `README.md` — This file. Human-facing reference for the board configuration.
- `AGENTS.md` — Machine-facing reference for autonomous agents

## Working with the board

Tasks can be managed through any combination of:

- **The ShipBench CLI** (`shipbench` commands) — recommended for scripted or agent-driven changes; centralizes slug generation, validation, timestamps, and layout updates.
- **The Board UI** (`shipbench board`) — local kanban with live file watching.
- **Harbor** — hosted view for browsing project boards across repos.
- **Direct file editing** — always valid; task files are plain Markdown.

## `config.json` reference

Every field has a sensible default. `config.json` is deep-merged over ShipBench's built-in defaults on read, so you can delete any block you don't care about and it will fall back to default behavior. `shipbench init` scaffolds the full file for discoverability.

### `version`

Schema version. Currently informational. Leave as `1`.

### `name`

The project's display name. Every consumer (CLI, Board, Harbor) reads this for the breadcrumb root. Defaults to the basename of the current directory when `shipbench init` runs; override with `--name`.

### `columns`

The source of truth for valid task `status` values. Each entry is:

- `id` — used verbatim in task frontmatter `status` fields.
- `label` — what the Board UI displays as the column header.

Add a column by appending to the array (e.g. `{ "id": "review", "label": "Review" }`). Tasks that reference a column ID that no longer exists surface in an "Uncategorized" column on the board — they're never dropped.

### `default_column`

The column ID used when a task is created without an explicit `status` (`shipbench task create "..."`, the Board's new-task dialog). Must reference an existing column ID. If omitted, falls back to the first column in `columns`.

### `done_column`

The single column ID that represents task completion. Two behaviors ride on this:

- The board ignores manual `layout` order for this column and time-sorts by `updated` desc (most-recently-touched at the top). Within-column drag reorder is disabled.
- `done_display` (below) applies to it.

### `done_display`

Controls how the done column is rendered.

- `max` — number of most-recent done tasks shown by default. Older tasks live behind a `Show N more` toggle. Set to `0` (or any negative number) to disable the cap and show everything. Search bypasses the cap so hidden matches remain findable.

Omit `done_display` to fall back to `{ "max": 20 }`.

### `priority`

- `values` — the allowed `priority` values for task frontmatter.
- `default` — the value assigned when a task is created without a priority. Must appear in `values`.

Priority is optional on individual tasks; it just needs to match `values` when set.

### `schema.custom_fields`

Reserved for future user-defined frontmatter fields. Ignored today. Safe to leave as `{}`.

## `layout.json`

Per-column ordered list of task slugs — this is where manual within-column ordering is persisted (drag-and-drop on the board and task mutations write here). Rules:

- Tasks whose slug appears in `layout[columnId]` render in that order.
- Tasks with a matching status but no layout entry render below, sorted by `created` desc.
- Slugs in `layout` that don't correspond to a task on disk are ignored at render time.
- The Uncategorized column and the `done_column` both ignore `layout` entirely.
- The CLI and Board do not record `layout[done_column]`; any existing entry is removed on the next layout write.

Treat `layout.json` as machine-managed: do not hand-edit or hand-order it. You may gitignore it if ordering should stay machine-local, but Harbor and fresh clones will then fall back to deterministic `created`-descending order for unlisted tasks.

## Task files

Every file in `tasks/` is a Markdown document with a YAML frontmatter block. See `AGENTS.md` for the frontmatter schema and field rules — the same rules apply whether a human or an agent is editing.

Each task may end with a reserved `## Task Updates` section. Use it for time-anchored decisions, pivots, and external events that would lose meaning without their timestamp. Keep timeless facts in the description instead. Append an entry with `shipbench task comment <slug> "What changed and why."`; the CLI writes its ISO 8601 heading and updates the task timestamp.

Archived tasks live in `tasks/archive/` and are excluded from normal board reads. Archiving moves the file without changing its frontmatter or timestamps; unarchiving restores the same file to `tasks/`.
