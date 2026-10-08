---
title: Add a generic flag field for highlighting tasks on the board
status: backlog
priority: medium
tags:
  - core
  - board
  - cli
  - convention
created: '2026-10-08T18:54:05.596Z'
updated: '2026-10-08T18:54:05.596Z'
---

Add a generic, first-class `flag` field to task frontmatter so a task can be highlighted on the board for attention, independent of its status.

## Why

Status says where a task is in the workflow. It can't also say "look at this." A user could add a `blocked` column, but moving a task there loses where the work actually stands. A flag is orthogonal to status: an `in-progress` task can be flagged and stay `in-progress`.

The motivating example is a user watching agents work on a live board. An agent that is stuck flags its task, so the user sees right away that the task needs them, instead of assuming the agent is still busy. That is an example, not the definition. The flag is generic, and each project decides what it means (blocked, needs review, needs a decision, revisit later, and so on).

This is support through convention, not infrastructure. It is one informational field like `assignee`, with no locking, no workflow, and no agent-specific logic.

## Decisions so far

- **Field shape: `flag` holds a short reason, or `true`.** If the field is there, the task is flagged, and the text says why. `flag: true` is valid when there is no reason to give. An empty string is rejected on write. Longer explanations go in a Task Update (`task comment`). The flag is the headline.

  ```yaml
  flag: Waiting on decision about schema shape
  ```

- **Name: "flag," never "blocked."** `--blocked` already means "has unmet `depends_on`" in `task list` and `task search`. Don't add a second meaning.
- **First-class field, not `schema.custom_fields`.** The board has to render it prominently, so core and board both need to know about it. Custom fields have no rendering and no settled shape.
- **One flag per task. No configurable flag types.** Config-defined flag kinds (in the style of `priority`) would turn back into colored tags and lose the "look at this" meaning. If projects need more kinds later, that can be added without breaking anything.
- **No automatic clearing.** Moving a task, including to `done`, does not clear its flag. This follows "nothing is recorded automatically." Clearing has to be easy instead.
- **No `flag_by` / `flag_at`.** Git records who set it and when. Revisit only if "flagged N hours ago" turns out to matter on a live board.

## Scope

- **Core:** the `flag` field in the task type, validation (non-empty string or `true`, strict on write and graceful on read), serialization, and an `updated` bump when it changes. Update the frontmatter field table in `AGENTS.md`, `docs/spec.md`, and the scaffolded `.shipbench/AGENTS.md`.
- **CLI:** `task flag <slug> [reason]`, `task unflag <slug>`, a `--flagged` filter on `task list` and `task search` (shared predicate), and the flag shown in `task get` and in list output. Update `apps/cli/README.md` and the site's CLI reference.
- **Board:** an accent on flagged cards with the reason visible (on the card or on hover), a flagged count in the column header so a flag scrolled out of view is still noticed, a flagged filter, and a toggle to set or clear the flag. Done cards show a muted flag so a leftover flag is noticeable without being alarming. Follow `docs/design-doctrine.md` and `docs/board/design.md`.
- **Scaffold convention:** one example line in the `shipbench init` AGENTS.md, worded as an example rather than a rule: if you're stuck, set a flag with a short reason and add a comment, and clear the flag when you resume.
- **Harbor:** shows the flag read-only through the published board. There is no work in this repository beyond the board rendering it.
- **Release:** a minor changeset (new schema field).

## Open questions

- The exact card treatment and color token for the flag, especially next to priority styling.
- Whether search should match the flag's reason text.
