---
title: Stamp this repo's scaffolded files once 0.11.0 is published
status: backlog
priority: medium
tags:
  - convention
  - agents
related:
  - document-updating-scaffolded-files-after-a-shipbench-upgrade
created: '2026-11-23T23:39:56.031Z'
updated: '2026-11-23T23:39:56.031Z'
---

## Goal

Stamp this repository's own `.shipbench/README.md` and `.shipbench/AGENTS.md` once 0.11.0, the first release that stamps the scaffold, is published.

## Why it waits

Both files are unstamped. A stamp has to name a published version whose template the file started from, and a CLI built from source stamps the version in `package.json` (0.10.0 today), whose published template is older. Stamping now would record the wrong base.

## Steps

1. Regenerate the 0.11.0 scaffold: `npx shipbench@0.11.0 init --name shipbench` in an empty directory outside the repo.
2. `README.md` matched the unreleased template byte for byte on 2026-11-23. If it still matches the 0.11.0 template apart from the stamp line, replace it with the 0.11.0 file.
3. `AGENTS.md` carries this board's rules (status list, backlog rule, review gate, Finishing Work, Working From a Git Worktree, flag guidance). Diff it against the 0.11.0 template. If every difference is one of those rules, prepend the 0.11.0 stamp line. Any other difference is stale or new template text: take the 0.11.0 wording, then stamp.

From then on, upgrades follow the merge in [Upgrading ShipBench](../../apps/site/src/content/docs/upgrading.md).
