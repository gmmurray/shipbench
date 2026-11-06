---
title: Document updating scaffolded files after a ShipBench upgrade
status: backlog
priority: medium
tags:
  - docs
  - convention
  - agents
depends_on:
  - >-
    stamp-scaffolded-agents-md-and-readme-with-the-shipbench-version-that-wrote-them
created: '2026-10-27T22:35:10.192Z'
updated: '2026-10-27T22:35:10.192Z'
---

## Goal

A docs page, and a pointer from the scaffold, explaining how to bring a project's `.shipbench/AGENTS.md` and `README.md` up to date after upgrading ShipBench without losing the project's edits.

## Procedure (from the [scaffold drift spike](updating-shipbench-init-with-new-versions.md))

1. Read the stamp to get the base version, and the name from `config.json`.
2. Regenerate the base with `npx shipbench@<base> init --name <name>` in an empty directory, and the current scaffold the same way with the installed version.
3. If the project's file matches the base byte for byte, replace it with the current scaffold.
4. Otherwise run `git merge-file <project file> <base> <current>`, resolve any conflicts, and then read the whole result for base text that now contradicts a project rule. A line merge can't catch that.

For a file with no stamp, look for a published version that matches it byte for byte. If none does, the base is unknown. Fall back to diffing against the current scaffold and sorting each difference into stale text or project edit by hand, the way this repo's file was handled in the spike.

## Also

- Change the ownership table in [workflows.md](../../apps/site/src/content/docs/workflows.md) so the project owns `.shipbench/AGENTS.md` and updates it by merge. That matches spec.md's "edited freely."
- Decide whether the scaffold carries a one-line pointer to the page, which every future board would then have.
