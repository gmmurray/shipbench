---
title: >-
  Stamp scaffolded AGENTS.md and README with the ShipBench version that wrote
  them
status: backlog
priority: medium
tags:
  - convention
  - agents
  - dx
created: '2026-10-27T22:35:10.104Z'
updated: '2026-10-27T22:35:10.104Z'
---

## Goal

`shipbench init` records which version wrote `.shipbench/AGENTS.md` and `.shipbench/README.md`, so a later update can regenerate the exact base and three-way merge against it.

## Why

The [scaffold drift spike](updating-shipbench-init-with-new-versions.md) found that a merge is reliable only when it has the true base. With a guessed base, a stale file's missing line reads as a deliberate deletion. Every published version's scaffold can be regenerated from npm, so the version is all a project needs to record.

## Shape to settle

- **Where the stamp goes.** A first-line HTML comment such as `<!-- shipbench-scaffold 0.9.0 -->` is invisible in rendered Markdown and survives most edits. Agents read it as plain text, so the wording should explain what it's for, or at least not get in the way.
- **Whether to record the base hash too.** With a hash, "unedited" is a byte comparison and doesn't need npm. Without one, the base has to be regenerated to check. Decide whether that's worth a second token.
- **What generation depends on.** The project name is interpolated, and the status and priority lines come from `DEFAULT_CONFIG`. Regenerating the base needs the name, either from `config.json` `name` or from the stamp.
- **Optional reporting.** `init` on an existing project could report "AGENTS.md was written by 0.4.0; this is 0.9.0". Don't warn on every command.

The stamp changes the scaffold, so it needs a changeset (`shipbench`, minor).
