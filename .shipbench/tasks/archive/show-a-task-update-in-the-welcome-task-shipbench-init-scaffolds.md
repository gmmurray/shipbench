---
title: Show a Task Update in the welcome task shipbench init scaffolds
status: done
priority: medium
tags:
  - onboarding
  - core
  - init
created: '2026-09-23T21:46:02.421Z'
updated: '2026-09-27T19:02:48.234Z'
---

The welcome task `shipbench init` scaffolds (`generateWelcomeTask` in `packages/core/src/init.ts`) shows frontmatter, a description, and next steps. It has no `## Task Updates` section, so a new board never shows a timestamped entry, even though the site now presents Task Updates as half of what a task is for. The landing page, quickstart step 4, and both why pages all point at recording a decision on a task and finding it again. The first file a new user opens doesn't show it.

Add one Task Update to the scaffolded welcome task, plus a next-steps line for `shipbench task comment`, so the file shows the shape and the command that produces it.

## Constraints

- The entry must be a valid Update as core parses it: a column-0 `### <ISO 8601 timestamp>` heading under a trailing `## Task Updates` marker, timestamped from the same `now` as `created` and `updated`. Round-trip it through core's parser in the init tests. Don't just assert the string.
- The entry's text should model a good Update: something time-anchored that would lose meaning without its date, not a timeless fact that belongs in the description. The convention spec and the scaffolded `.shipbench/AGENTS.md` already teach that distinction, so match them.
- Keep it short. The welcome task is meant to be read once and deleted.
- `init` is non-destructive, so this only changes newly scaffolded projects. Existing boards keep their welcome task as it is.

## Not in scope

Refreshing files scaffolded into existing projects when ShipBench updates is [updating-shipbench-init-with-new-versions](updating-shipbench-init-with-new-versions.md). That task is broader and separate. This one only changes what a fresh `init` writes.

## Origin

Proposed in the next-steps assessment of [strengthen-and-correct-shipbench-s-public-explanation-across-the-site-and-docs-then-assess-next-steps](strengthen-and-correct-shipbench-s-public-explanation-across-the-site-and-docs-then-assess-next-steps.md). It passes that task's durability filter: it teaches the convention itself and isn't tied to any agent's limits.

## Task Updates

### 2026-09-27T19:01:24.739Z
Implemented. The scaffolded entry reads "Set up this board with `shipbench init`." It records the board's creation, an event that needs its date, and doesn't explain Updates inside an Update. The explanation stays in the description's new next-steps line, which uses the welcome task's own slug so the command runs as written.

Six CLI `task comment` tests assumed a fresh welcome task had no Updates. They now act on the entries they add after the scaffolded one, and the delete test still removes the last entry to show the `## Task Updates` heading goes with it. The changeset names `shipbench` at minor because an appended Update now lands at index 1 instead of 0.
