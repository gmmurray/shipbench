---
title: Surface a task whose frontmatter cannot be parsed instead of dropping it
status: review
priority: high
tags:
  - core
  - board
  - cli
  - validation
created: '2026-09-19T23:05:04.474Z'
updated: '2026-09-26T21:18:43.804Z'
---

An agent working in a ShipBench project hand-edited frontmatter into two tasks
that already carried `depends_on`, producing a duplicate YAML key. Both tasks
left the board. Reproduced in a scratch project against the built CLI: a second
`depends_on:` line makes js-yaml throw `duplicated mapping key`, and from that
point the file is not a task anywhere in the system.

Every other malformed state ShipBench knows about stays visible. An unknown
status renders in Uncategorized. An unfamiliar frontmatter field is preserved
and warned about. An unreadable `## Task Updates` section is quarantined onto
the task and shown as unreadable in the Board
(`show-an-unreadable-updates-section-in-the-board`). Frontmatter that does not
parse is the one case with nothing to attach a warning to, so the task is simply
absent — the failure mode a task tracker can least afford.

## Verified behavior

- `listTasksInDirectory` catches the parse error, pushes a `frontmatter`
  warning keyed by slug, and omits the file from `tasks`.
- The CLI does report it, contrary to the original report: `task list` prints a
  trailing `Warnings:` block on stderr, and `--json` carries the warning in
  `warnings[]`. Both exit 0, and `tasks[]` looks complete on its own — which is
  how an agent reading the array misses it.
- `task get <slug>` exits 1 with the raw js-yaml message. It names a line and
  column but not the file or the slug, and gray-matter's offset arithmetic
  reports a negative column.
- The Board shows nothing at all. `boardStore` holds `state.warnings`, but
  `DetailView` is the only consumer and filters by the open task's slug. A file
  that produced no task has no card to open. Harbor inherits this and is
  read-only, so the disappearance cannot even be diagnosed there.

## Scope

- Give core a way to return the unreadable file as something rather than
  nothing — slug, raw content, and the parse reason — so hosts have an entity to
  render. The quarantine pattern from the Updates work is the precedent; decide
  whether it belongs in the existing `TaskReadResult` shape or beside it, and
  what `getTask` returns for such a file.
- Render it in the Board as a read-only broken card, showing the reason and the
  raw frontmatter verbatim. Rendered Markdown would hide the markup that caused
  the failure, which is the one thing the reader needs.
- Make it visible in CLI list output itself, not only in the trailing warnings
  block, and name the file and slug in the `task get` error.
- Decide exit behavior deliberately and record the reasoning. Non-zero on a read
  that could not parse a file is defensible and would break scripts that
  tolerate warnings today.

## Not in scope

Repairing the file from the Board or the CLI. The repair belongs in the file, as
it did for malformed Updates; this task is about making sure someone knows to
open it.

`expose-a-consistent-cli-project-validation-report` covers a deliberate
health-check command and is adjacent, not a prerequisite. This task is about the
default read path — the one an agent uses without being told to go looking.

## Task Updates

### 2026-09-26T21:18:43.717Z
Decisions made while implementing:

- **Shape: beside `tasks`, not inside it.** `TaskReadResult` gained a required `unreadable: UnreadableTaskFile[]` (`slug`, `path`, verbatim `content`, `reason`). A placeholder `Task` would have a missing title and status, and every consumer that reads those would crash or render a phantom card. Making the field required means a `BoardAPI` host that builds its own result can't silently leave it out. The `frontmatter` warning stays for consumers that only read warnings.
- **`getTask` throws rather than returning a special value.** `null` already means "no such file", and a union return type would burden every caller for a rare case. `getTask` and every mutation throw `UnreadableTaskError`. Its message names the task and the file, and its `file` carries the same record a list returns, so a host can still render it.
- **The reason is built from js-yaml's `reason` and line only.** The line counts from the opening `---`, so it is the file's own line number, checked for LF, CRLF, and BOM files. The column is dropped: js-yaml's `message` repeats a snippet and a column that isn't reliable once gray-matter has sliced the frontmatter out.
- **Frontmatter that parses to a list or a bare value also counts as unreadable.** It used to come through as a task with fields named `0`, `1`, and so on.
- **Exit behavior: `task list` and `task search` still exit 0.** The read succeeded, and the broken file is now in the output itself: an `[unreadable]` line on stdout and an `unreadable` array in JSON, which no filter, `--available`, or `--limit` can remove. Non-zero would break scripts that tolerate warnings today, and it would make "the project has a broken file" look the same as "the command failed". A deliberate non-zero health check belongs to `expose-a-consistent-cli-project-validation-report`. `task get` on the file exits 1, because it can't return the task.
- **The Board puts the Unreadable column at the leading edge.** Uncategorized sits at the trailing edge, but these files are otherwise absent entirely, and on a wide board a trailing column is past the fold. This is a judgment call for review.
- **Board server: a write to an unreadable file answers 422.** Before, it was a 500.

Not covered, and possibly worth its own task: frontmatter that parses as a mapping but has no `title` or `status` (for example an empty `---\n---` block, or a Markdown file with no frontmatter) still loads as a task without them. That is a validation gap rather than a parse failure, so I left it out of scope.
