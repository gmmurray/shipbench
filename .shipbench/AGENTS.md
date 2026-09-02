# shipbench — ShipBench Agent Instructions

This file describes how to interact with the ShipBench task board for **shipbench**.

## Directory Structure

```
.shipbench/
  config.json          # Board configuration — read this for valid values
  layout.json          # Partial placement index — do not read as visible order
  tasks/               # One Markdown file per task
    <slug>.md
    archive/            # Archived tasks — do not read unless asked
      <slug>.md
```

## Task File Format

Each task is a Markdown file with YAML frontmatter:

```markdown
---
title: Task title here
status: todo
priority: medium
assignee:
tags: []
depends_on: []
created: 2024-01-01T00:00:00.000Z
updated: 2024-01-01T00:00:00.000Z
---

Task description in Markdown.
```

## Field Rules

- **title** (required): Display name of the task.
- **status** (required): Must be one of: backlog, todo, in-progress, review, done. Read `config.json` columns for current valid values.
- **priority** (optional): Must be one of: low, medium, high. Defaults to "medium".
- **assignee** (optional): Freeform string label (e.g. `claude`, `antigravity`, or `human`). Informational only — task eligibility is governed strictly by `status` and `depends_on`. Moving a task to `in-progress` signals that work has started.
- **tags** (optional): Array of freeform strings.
- **depends_on** (optional): Array of task slugs that must be finished before this task can start. An omitted field and an empty array mean the same thing. A slug must name a task file that exists; a task may not depend on itself, and two tasks may not depend on each other.
- **created** (required): ISO 8601 timestamp. Set once on creation, never modify.
- **updated** (required): ISO 8601 timestamp. Update on every modification.

## Task Updates

A task may end with a reserved `## Task Updates` section containing timestamped entries:

```markdown
## Task Updates

### 2026-07-24T20:00:00.000Z
Raised priority after the customer escalation.
```

Before adding an entry, ask: **Would this fact still be true or relevant regardless of when it happened?** If yes, edit the task description in place. If its meaning depends on a moment — a decision, pivot, scope change, or external event — add an Update.

This heuristic is guidance, not a validation rule. Core stores each entry as `{ timestamp, text }` and never judges or reformats the prose. A project may use Updates as a general comments log if that serves its workflow.

Append through `shipbench task comment <slug> "What changed and why."`. Edit text with `shipbench task comment edit <slug> <index> "Corrected text."`; delete an entry with `shipbench task comment delete <slug> <index>`. Indices are zero-based. Editing never changes the entry's timestamp. Git preserves earlier text and deleted entries.

Append and edit both accept `--body <text>` or `--body-file <path>` instead of the positional text, the same pair `task create` and `task edit` take. Use `--body-file` for anything multi-line: ShipBench reads the file as UTF-8, so the text never passes through shell quoting or encoding.

Update text is prose. Markdown headings inside it are yours to use — only a column-0 `### <ISO 8601 timestamp>` line opens a new entry. Three things are rejected on write, because the next read would mis-file them: a `## Task Updates` heading of its own, a column-0 heading whose text is a date, and an unclosed code fence.

A description may not contain a `## Task Updates` heading of its own — the next read would file part of it as entries, so ShipBench rejects the write. It also may not leave a code fence open, which would swallow the marker below it and hide every entry. Put the heading in a code fence when a description means it literally.

Do not hand-edit content below the `## Task Updates` marker when the CLI is available.

## Choosing What to Work On

Read the narrowest thing that answers your question. Because each task has a slug, use a body-free list or search to narrow the candidates, then run `task get` or read one `.shipbench/tasks/<slug>.md` file. Read multiple descriptions or archived tasks only when needed.

Do not pick up tasks in the `backlog` column. Backlog holds spikes and
not-yet-committed work — information gathering that a human promotes to `todo`
when it's ready. Select work from `todo`.

`depends_on` is the authoritative dependency signal. Start with:

```bash
shipbench task list --available --json
```

`--available` selects tasks from the default `todo` column whose dependencies are all in `done` or `tasks/archive/`. Archived dependencies count as satisfied. Results are ranked by configured priority, then oldest creation time.

That ranking is not the board's order. `--available` sorts by priority and age and does not read manual placement, while a plain `shipbench task list` returns the order the columns are actually arranged in. The two can disagree — a task sitting first in its column may come back third here — and neither is the more correct answer. JSON carries both: the array is in ranked order, and each task's `position` is its board placement, computed before the ranking. Read whichever answers the question you have.

Narrow the candidate set without loading every description:

```bash
shipbench task list --available --tag docs --json
shipbench task list --available --tag docs,site --assignee agent --json
```

`--tag` accepts comma-separated values or repeated flags and uses AND semantics. `--status`, `--assignee`, `--priority`, and `--limit` can narrow the same query.

After selecting a slug, run `shipbench task get <slug>` to load its full frontmatter, description, and Updates.

Use the other discovery commands when needed:

- **Diagnose blocked work**: `shipbench task list --blocked --json`
- **Search titles, tags, and descriptions**: `shipbench task search "<query>" --json`
- **Load complete matching descriptions**: `shipbench task search "<query>" --json --include-body`
- **Search live and archived tasks**: `shipbench task search "<query>" --all --json`
- **Inspect the dependency DAG**: `shipbench task graph --json` (add `--archived` to resolve archived nodes)
- **List archived tasks**: `shipbench task list --archived --json`

Following that principle, add `--include-body` to a JSON `task list` only when every returned description and Updates array is needed. Add it to a JSON `task search` for complete matching descriptions. Prefer `task get` after narrowing when one matching task answers the question.

`--available` and `--blocked` are mutually exclusive and cannot be combined with `--archived`.

A task with unfinished dependencies is not ready, even if nothing prevents you from editing it — `depends_on` is data, not a lock.

Prose sections in a task body (`## Depends on`, `## Blocked by`, and similar) are commentary. Read them for context, but do not treat them as the dependency graph.

Note that `depends_on` and the task's column are orthogonal. A column says where a task is; `depends_on` says what has to land first.

## Reading Board Order

`layout.json` is a partial, machine-managed index, not the visible order. It can omit `done_column`, unlisted tasks, and whole columns; retain stale slugs until another layout write; or be absent or gitignored. Reading it alone can therefore give the wrong answer.

`shipbench task list --json` reports live tasks in configured column order and visible within-column order, including each task's zero-based `position` within its column. When working directly with the plain files, combine task statuses with `config.json` and the ordering rules in `README.md`; do not use `layout.json` alone as the answer.

## Changing Board Order

`shipbench task move` accepts placement flags — `--top`, `--bottom`, `--before <slug>`, `--after <slug>`, and `--position <n>` (0-based, `-1` appends) — and `--to` is optional, so omitting it reorders within the task's current column. Anchors are the clearer interface: `--before build-api` states an intent, while a raw index depends on what the column looks like right now. Placement flags are mutually exclusive and cannot target the done column, which is always sorted by `updated` desc.

This is the only sanctioned way to reorder. `layout.json` stays off-limits to hand edits.

Ordering is a human judgment call, so reorder only when the user explicitly asks — never as a side effect of other board work, the same posture as `task delete`.

## Finishing Work

When you finish work on a task, move it to `review` — never to `done`. The `done` column is reserved for the human owner to mark after verifying the work.

## Working From a Git Worktree

The board is branch-local: task status only means anything in the canonical checkout — the main working copy on `main`, where the live board runs. When working inside a feature worktree:

- **Never change a task's `status` from the worktree.** Run `task move` from the canonical checkout's directory so the live board stays truthful. If you cannot reach the canonical checkout, say so instead of moving the task on your branch.
- **You may write to your own task from the worktree**: append Task Updates, refine its description, and create follow-up tasks. Those changes ride your branch and merge in with the code.
- **Read before you edit.** Your worktree's copy of a task may be stale. Load the current version from the canonical checkout (`task get` run there) before editing a description.
- **Touch nothing else in `.shipbench/` from a worktree**: no other agents' tasks, no `config.json`, no `layout.json`.

## File Naming

- Filenames are slugified from the title: lowercase, hyphens for non-slug characters, no special characters.
- If a slug already exists in either `tasks/` or `tasks/archive/`, append a numeric suffix: `my-task-2.md`. Archived slugs are never reused.

## Operations

Prefer the ShipBench CLI for task mutations when it is available. The CLI routes through core, so slug generation, validation, timestamps, collision handling, and layout updates stay consistent.

### Preferred CLI Operations

- **List available tasks**: `shipbench task list --available --json`
- **List blocked tasks**: `shipbench task list --blocked --json`
- **Filter by tags**: `shipbench task list --available --tag docs,site --json`
- **Read one task**: `shipbench task get <slug>`
- **Search tasks**: `shipbench task search "<query>" --json`
- **Inspect dependencies**: `shipbench task graph --json`
- **Include descriptions in a list**: `shipbench task list --json --include-body`
- **Create a task**: `shipbench task create "Task title" --status=todo`
- **Create a task with a description**: `shipbench task create "Task title" --body-file=description.md` (or `--body "One-line description."`)
- **Rewrite a description**: `shipbench task edit <slug> --body-file=description.md` (replaces it whole; `--body ""` clears it)
- **Create a dependent task**: `shipbench task create "Task title" --depends-on=other-slug,another-slug`
- **Add a time-anchored update**: `shipbench task comment <slug> "What changed and why."`
- **Add a multi-line update**: `shipbench task comment <slug> --body-file update.md`
- **Edit an update's text**: `shipbench task comment edit <slug> <index> "Corrected text."` (also takes `--body-file`)
- **Delete an update**: `shipbench task comment delete <slug> <index>`
- **Move a task**: `shipbench task move <slug> --to=in-progress`
- **Submit a task for review**: `shipbench task move <slug> --to=review`
- **Reorder a task when explicitly asked**: `shipbench task move <slug> --before=other-slug` (also `--top`, `--bottom`, `--after`, `--position <n>`)
- **Archive a task**: `shipbench task archive <slug>`
- **Bulk archive done tasks when explicitly requested**: `shipbench task archive --done` (add `--keep=N` to retain a specific number)
- **List archived tasks**: `shipbench task list --archived`
- **Unarchive a task**: `shipbench task unarchive <slug>`
- **Delete a task**: `shipbench task delete <slug>`
- **Open the board**: `shipbench board`

### Direct File Operations

Use direct edits only when the CLI is unavailable or when changing task description/frontmatter fields the CLI does not support yet.

- **Create a task**: Add a new `.md` file in `tasks/` following the format above.
- **Move a task**: Change the `status` field and update the `updated` timestamp.
- **Edit a task**: Modify frontmatter fields and/or the description above `## Task Updates`. Always update `updated`. The CLI reaches descriptions — use `task edit` rather than rewriting a file by hand.
- **Add an Update without the CLI**: Append a `### <ISO 8601 timestamp>` heading and text below the trailing `## Task Updates` marker.
- **Edit an Update without the CLI**: Change only its text; preserve the `###` timestamp heading and update the frontmatter `updated` value.
- **Delete an Update without the CLI**: Remove its heading and text, remove an empty `## Task Updates` section, and update the frontmatter `updated` value.
- **Delete a task**: Remove the `.md` file.

## Important

- Never invent status values not listed in `config.json`.
- Move finished work to `review`; only the human owner moves tasks to `done`.
- Never run the bulk archive form (`task archive --done`) unless explicitly asked — it moves many files at once.
- Reorder tasks only when the user explicitly asks for it.
- Always update the `updated` timestamp when modifying a task by hand. Every CLI mutation maintains it for you.
- Do not modify `config.json` unless explicitly asked.
- Do not read `layout.json` as the visible order or modify it; the CLI and Board own this partial index.
- Do not read or modify `tasks/archive/` unless the user explicitly asks about archived work.
- Do not modify the `created` timestamp.
