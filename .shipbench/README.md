# shipbench — ShipBench Project Board

This directory contains the ShipBench project board for **shipbench**. Everything lives in Git alongside your code — no external service required.

## Structure

- `config.json` — Human-owned board configuration (columns, priorities, schema)
- `layout.json` — Machine-managed partial index of manual placements
- `tasks/` — Individual task files as Markdown with YAML frontmatter
- `tasks/archive/` — Archived task files, kept byte-for-byte for later restore
- `README.md` — This file. Human-facing reference for the board configuration.
- `AGENTS.md` — Machine-facing reference for autonomous agents

## Working with the board

Tasks can be managed through any combination of:

- **The ShipBench CLI** (`shipbench` commands) — recommended for scripted or agent-driven changes; centralizes slug generation, validation, timestamps, and layout updates.
- **The Board UI** (`shipbench board`) — local kanban in your browser, with live file watching.
- **The terminal board** (`shipbench board terminal`) — the same board as a read-only live view, for leaving open in a pane beside your work.
- **Direct file editing** — always valid; task files are plain Markdown.

## `config.json` reference

Every field has a sensible default. `config.json` is deep-merged over ShipBench's built-in defaults on read, so you can delete any block you don't care about and it will fall back to default behavior. `shipbench init` scaffolds the full file for discoverability.

### `version`

Schema version. Currently informational. Leave as `1`.

### `name`

The project's display name. Every consumer (the CLI and the Board) reads this for the breadcrumb root. Defaults to the basename of the current directory when `shipbench init` runs; override with `--name`.

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

`layout.json` is a partial, machine-managed index of manual placements. It is not a complete snapshot of visible board order: it can omit whole columns and unlisted tasks, never retains `done_column`, may carry stale slugs until a relevant write prunes them, and may be absent or gitignored.

Visible order comes from `config.json`, the task files, and this partial index together:

- Configured columns render in `config.columns` order, followed by Uncategorized tasks.
- Tasks whose slug appears in `layout[columnId]` render in that order.
- Tasks with a matching status but no layout entry render below, sorted by `created` desc.
- Slugs in `layout` that don't correspond to a task on disk are ignored at render time.
- The Uncategorized column and the `done_column` both ignore `layout` entirely.
- The CLI and Board do not record `layout[done_column]`; any existing entry is removed on the next layout write.

Do not read `layout.json` alone to determine board order. `shipbench task list --json` returns live tasks in canonical board order, including each task's zero-based `position` within its column. Direct file readers must apply the rules above. Treat the index as machine-managed: do not hand-edit or hand-order it. You may gitignore it if ordering should stay machine-local, but fresh clones will then fall back to deterministic `created`-descending order for unlisted tasks.

## Task files

Every file in `tasks/` is a Markdown document with a YAML frontmatter block. See `AGENTS.md` for the frontmatter schema and field rules — the same rules apply whether a human or an agent is editing.

Read the narrowest thing that answers the question. Because each task has a slug, read one task when one task is enough. Use list, search, or archive reads only for broader questions.

Write a description with the task instead of after it: `shipbench task create "Task title" --body-file description.md`, and `shipbench task edit <slug> --body-file revised.md` to replace one. ShipBench reads the file as UTF-8 itself, so multi-line Markdown never passes through shell quoting or a shell's encoding.

Each task may end with a reserved `## Task Updates` section. Use it for time-anchored decisions, pivots, and external events that would lose meaning without their timestamp. Keep timeless facts in the description instead. Append with `shipbench task comment <slug> "What changed and why."`, edit text with `shipbench task comment edit <slug> <index> "Corrected text."`, or delete with `shipbench task comment delete <slug> <index>`. Indices are zero-based. Edits preserve the entry's timestamp; Git preserves earlier text and deleted entries.

Both commands also take `--body <text>` and `--body-file <path>` in place of the positional text, and `--body-file` is the one to reach for when an update runs to several lines: ShipBench reads the file as UTF-8 itself, so the prose never passes through shell quoting or a shell's encoding.

Archived tasks live in `tasks/archive/` and are excluded from normal board reads. Archiving moves the file without changing its frontmatter or timestamps; unarchiving restores the same file to `tasks/`.
