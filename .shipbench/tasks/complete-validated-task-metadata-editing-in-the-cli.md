---
title: Complete validated task metadata editing in the CLI
status: done
priority: high
tags:
  - cli
  - core
  - agents
  - dx
created: '2026-09-06T18:32:57.540Z'
updated: '2026-09-08T22:59:01.887Z'
---

The CLI can set metadata at creation, but task edit currently replaces only the description. Agents adjusting priority, tags, assignee, or dependencies must use another surface or edit frontmatter themselves. Round out the CLI so normal task maintenance keeps using core's validation and preservation rules.

## Decisions before implementation

Choose explicit set, clear, add, and remove semantics appropriate to each supported field. Keep status and placement consistent with task move. Decide whether title edits preserve the existing slug and how that behavior is communicated; do not introduce implicit file renames.

Define the behavior of combined edits and failed validation before exposing flags. Reuse core rather than duplicating schema rules in the CLI.

## Acceptance

- A caller can revise priority, assignee, tags, dependencies, and title through documented validated operations.
- Invalid changes produce actionable errors without leaving unintended partial task edits.
- Description, Updates, unfamiliar fields, created timestamp, and stable references survive unrelated metadata changes.
- Successful mutations maintain updated through core.
- Array changes have clear replacement versus incremental semantics; clearing a field is explicit.
- CLI help, reference, generated guidance where appropriate, and focused mutation tests reflect the final interface.

This is a bounded CLI-completeness task, not an agent assignment or orchestration system.

## Task Updates

### 2026-09-06T19:41:24.895Z
Board review folded a filter-flag defect into this task's scope. `task list --status backlog,todo` returns zero tasks and exits successfully: --status accepts a single value, while --tag accepts comma-separated values or repeated flags, and the mismatch fails silently instead of erroring. An agent narrowing a query that way sees an empty board and no indication that the filter was the cause.

Include it here because this task already has to settle replacement versus incremental semantics for array-valued fields; multi-value flag parsing is the same decision on the read side, and splitting it into its own ticket would decide it twice. Choose one rule for how a multi-valued flag is expressed across list filters and edit operations, and make a value that cannot match produce an actionable error rather than an empty result. Verify --status alongside --tag, --assignee, and --priority.

### 2026-09-08T22:35:00.868Z
Implemented. `shipbench task edit` now revises validated metadata alongside the description:

- `--title` (slug/filename never change), `--priority`, `--assignee`/`--clear-assignee`
- `--tags`/`--add-tag`/`--remove-tag`/`--clear-tags` and the matching `--depends-on` family
- Replacement vs. incremental forms are mutually exclusive; clearing is always its own flag.
- All requested changes go through one `updateTask` call, so core validation runs before any write and a rejected value leaves the task untouched.
- Status and placement deliberately stay with `task move`; Updates stay with `task comment`.

Core: `updateTask` now rejects a title with no slug-able character (mirrors `createTask`).

Filter-flag defect (folded in at board review): `--status`, `--assignee`, `--priority` on `task list` and `task search` now take a comma-separated / repeated list matching any listed value (`--tag` keeps AND). An unconfigured `--status`/`--priority` value is now an actionable error instead of an empty result — `task list --status backlog,todo` used to match nothing and exit 0. `TaskAvailabilityOptions.status` accepts a list.

Docs/guidance updated: CLI help, `apps/cli/README.md`, `docs/spec.md`, `apps/site` cli-reference + concurrent-agents, the `shipbench init` AGENTS.md scaffold, and this repo's `.shipbench/AGENTS.md`. Changeset added (`@shipbench/core` + `shipbench` minor). New focused tests in `cli.test.ts`, `tasks.test.ts`, `availability.test.ts`; full suite + typecheck + lint green.

Note: `board terminal --status` was left as-is — there it selects which columns render rather than filtering tasks, and it already accepts a list and reports unknown ids.
