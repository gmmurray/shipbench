---
title: Expose a consistent CLI project validation report
status: todo
priority: medium
tags:
  - cli
  - core
  - validation
  - dx
created: '2026-09-06T18:32:59.325Z'
updated: '2026-09-06T18:32:59.325Z'
---

ShipBench reports useful warnings while reading tasks and configuration. Provide one deliberate command for checking the project's structural health after manual edits, merges, or a batch of agent changes.

## Decisions before implementation

Choose the command, warning/error categories, exit behavior, and machine-readable report shape. Define the scope of live tasks, optional archive inspection, configuration, dependency consistency, and layout references. Reuse the established validators and graceful-read behavior.

Distinguish invalid data from supported states such as an absent layout file or preserved unfamiliar fields. Do not treat a convention preference or task-content judgment as a schema failure.

## Acceptance

- Report each actionable structural problem with its source and useful repair context.
- Continue inspecting other readable files after one malformed task.
- Make archive inspection explicit and keep stdout JSON clean.
- Return stable exit behavior suitable for scripts or optional CI use.
- Leave all project files unchanged; repairs require a separate explicit action.
- Check representative malformed and valid partial configurations and task files.
- Document what the command can establish. It validates structure, not whether a task is substantively finished or its rationale is correct.
