---
title: ShipBench Project Files
description: The ShipBench project-system specification for task Markdown, dependencies, updates, ordering, and archives.
group: Guides
order: 1
updated: 2026-08-30
---

The ShipBench project system stores planning data in a small set of files inside each Git repository. These files stand on their own: the ShipBench CLI, local board, ShipBench Harbor, and coding agents are clients of the same project data. This page defines those files and the behavior required of clients that read or write them.

## Directory structure

```text
.shipbench/
├── config.json          # Human-owned board configuration
├── layout.json          # Machine-managed partial placement index
├── README.md            # Human-facing project-board reference
├── AGENTS.md            # Machine-facing agent instructions
└── tasks/
    ├── setup-auth.md    # One live task per Markdown file
    └── archive/         # Archived tasks
```

Tasks live in `tasks/`. Archived tasks live in `tasks/archive/` and stay out of normal board reads and searches unless a command explicitly includes the archive.

Read the narrowest thing that answers the question. Because each task has a slug, read one task when one task is enough. Use list, search, multiple descriptions, or archive reads only for broader questions. This principle applies to the CLI and direct file access.

## Project configuration

`config.json` defines the project name, board columns, completion column, priorities, and future custom fields. A fresh project starts with:

```json
{
  "version": 1,
  "name": "my-project",
  "columns": [
    { "id": "todo", "label": "To Do" },
    { "id": "in-progress", "label": "In Progress" },
    { "id": "done", "label": "Done" }
  ],
  "default_column": "todo",
  "done_column": "done",
  "done_display": { "max": 20 },
  "priority": {
    "values": ["low", "medium", "high"],
    "default": "medium"
  },
  "schema": { "custom_fields": {} }
}
```

Column IDs are the valid values for a task's `status`; labels are display text. `default_column` receives new tasks that omit `--status`. `done_column` identifies completion for dependency checks, board ordering, display limits, and bulk archiving.

`config.json` may be partial. Readers deep-merge it over the built-in defaults, so you may omit blocks you do not customize. Arrays such as `columns` and `priority.values` define the complete configured list, so include every value you want to keep when replacing them.

## Task files

Each task is a Markdown document named by its slug:

```markdown
---
title: Setup GitHub OAuth
status: in-progress
priority: high
assignee: agent
tags: [auth, backend]
depends_on: [choose-auth-provider]
created: 2026-07-21T03:49:00.000Z
updated: 2026-07-24T20:00:00.000Z
---

Implement the callback route and token exchange.

## Task Updates

### 2026-07-24T20:00:00.000Z
Switched to PKCE after the security review.
```

The YAML frontmatter carries structured data. The content below it is the task description, written in ordinary Markdown. An optional trailing `## Task Updates` section carries timestamped entries.

| Field | Required | Meaning |
| --- | --- | --- |
| `title` | Yes | Human-readable task title. |
| `status` | Yes | A column ID from `config.json`. |
| `priority` | No | A value from `priority.values`; creation uses the configured default. |
| `assignee` | No | Freeform informational label. It does not claim or lock work. |
| `tags` | No | Array of freeform strings. |
| `depends_on` | No | Array of task slugs that must finish first. |
| `created` | Yes | ISO 8601 timestamp recorded when the task is created and never changed. |
| `updated` | Yes | ISO 8601 timestamp changed by task-content and status mutations. Layout-only reorders and archiving leave the task file unchanged. |

Readers preserve unknown frontmatter fields and report them as warnings. Subsequent writes must retain fields they do not recognize.

## Slugs and dependencies

New task filenames derive from their titles: lowercase, hyphenated, and stripped of special characters. If the resulting slug exists in either the live or archive directory, task creation appends a numeric suffix such as `setup-auth-2.md`. Archived slugs remain reserved so dependency references stay unambiguous.

`depends_on` is data, not a lock. It does not prevent edits or column moves. Writes reject an unknown slug, a self-reference, and a direct two-task cycle. Reads keep a task with a dangling dependency visible and report a warning.

A dependency is satisfied when it is:

- a live task in `done_column`, or
- present in `tasks/archive/`.

Use `shipbench task list --available` to select tasks whose dependencies are satisfied, `--blocked` to find tasks still waiting, and `shipbench task graph` to inspect forward and reverse relationships.

## Task Updates

The reserved trailing `## Task Updates` section separates time-anchored entries from the timeless description. Each entry has an ISO 8601 `###` heading followed by Markdown text.

Use this question to choose where a fact belongs:

> Would this still be true or useful without knowing when it happened?

If yes, edit the description. If the moment matters—a decision, pivot, scope change, or external event—append an Update:

```bash
shipbench task comment setup-github-oauth \
  "Switched to PKCE after the security review."
```

This placement heuristic is guidance, not a validation rule. Update text may contain arbitrary Markdown; readers do not judge its prose. You may use the section as a freeform comments log. It is a curated task record, not an automatically generated change log; Git already records file history.

A well-formed trailing Updates section is separate from the task description above it. If the section is malformed, readers keep its raw Markdown with the description, return no parsed entries, and report an `updates` warning instead of dropping the task.

You may correct an entry's text or delete a wrong entry. Commands address entries by zero-based index:

```bash
shipbench task comment edit setup-github-oauth 0 \
  "Kept PKCE after the second security review."
shipbench task comment delete setup-github-oauth 0
```

Editing preserves the entry's `###` timestamp; deleting removes the entry. Both actions update the task's `updated` field. Git keeps the earlier text or deleted entry for recovery.

## Layout and ordering

Choose whether manual board order belongs to the project or only to each checkout:

- Commit `.shipbench/layout.json` when every clone and ShipBench Harbor should share the same drag-and-drop order.
- Add `.shipbench/layout.json` to `.gitignore` when each checkout should keep its own order.

Both strategies are valid. A missing or gitignored `layout.json` makes ShipBench use deterministic timestamp ordering, so fresh clones and ShipBench Harbor still render a stable board. If the file is already tracked, remove it from Git's index after adding the ignore rule:

```bash
git rm --cached .shipbench/layout.json
```

Tracked or ignored, `layout.json` stores a partial index of manual placements as a record of column IDs to task slugs:

```json
{
  "todo": ["setup-auth", "build-api"],
  "in-progress": ["landing-page"]
}
```

Treat this file as machine-managed. Operations that change manual task placement update it. It is not a complete snapshot of visible order. It can omit whole columns and unlisted tasks, never retains `done_column`, may carry stale slugs until another layout write, and may be absent or gitignored.

Visible ordering combines `config.json`, the task files, and the partial layout index:

- Configured columns render in `config.columns` order, followed by Uncategorized tasks.
- Listed tasks in a regular column render in `layout.json` order.
- Unlisted tasks render below them, newest `created` timestamp first.
- Missing or stale slugs are ignored and pruned by relevant writes.
- The Uncategorized column ignores layout and sorts by `created`, newest first.
- `done_column` ignores layout and sorts by `updated`, newest first.
- `done_display.max` caps the visible done tasks; search bypasses the cap.

Do not read `layout.json` alone to determine board order; it can give an incomplete or stale answer. `shipbench task list` reports live tasks in configured column order and visible within-column order, and JSON output includes each task's zero-based `position` within its column. Direct file readers can apply the rules above to the individually addressable task files.

## Archiving

Archiving moves a task byte-for-byte to `tasks/archive/<slug>.md`. It does not change frontmatter, status, or timestamps, so unarchiving restores the same task.

Any task can be archived. An archive request for a non-done task with live dependents must fail unless the caller explicitly forces it. Bulk archiving is always explicit; the convention defines no automatic archiving.

See the [ShipBench CLI Reference](/docs/cli-reference) for archive commands and safeguards.

## Validation model

The convention requires strict writes and graceful reads.

- Writes reject invalid statuses, priorities, timestamps, dependencies, and malformed fields.
- Reads return recoverable tasks with warnings, including unknown statuses and fields.
- A file with malformed YAML is skipped with a warning; other readable tasks remain available.
- Tasks with an unknown status appear in the board's Uncategorized column.

This balance keeps structured tools safe without making hand-edited Markdown fragile.
