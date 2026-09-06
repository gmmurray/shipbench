---
title: Complete validated task metadata editing in the CLI
status: todo
priority: high
tags:
  - cli
  - core
  - agents
  - dx
created: '2026-09-06T18:32:57.540Z'
updated: '2026-09-06T19:41:24.895Z'
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
