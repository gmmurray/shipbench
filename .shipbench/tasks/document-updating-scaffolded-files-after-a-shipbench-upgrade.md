---
title: Document updating scaffolded files after a ShipBench upgrade
status: done
priority: medium
tags:
  - docs
  - convention
  - agents
depends_on:
  - >-
    stamp-scaffolded-agents-md-and-readme-with-the-shipbench-version-that-wrote-them
created: '2026-10-27T22:35:10.192Z'
updated: '2026-11-23T23:45:54.318Z'
related:
  - stamp-this-repo-s-scaffolded-files-once-0-11-0-is-published
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

## Task Updates

### 2026-11-23T23:40:07.737Z
Implemented as [Upgrading ShipBench](../../apps/site/src/content/docs/upgrading.md) at `/docs/upgrading/`, in Guides. It covers stamped files (regenerate base and current with npx, replace an unedited file, otherwise `git merge-file`, then read the whole result for contradictions), unstamped files (date the file, look for a matching published version, and fall back to sorting the diff against the current template by hand), and doing the update with an agent.

How the open questions were decided:

- **Ownership.** The workflows.md table now says you own `.shipbench/AGENTS.md`, starting from ShipBench's template and merging in each new one, which matches spec.md's "edited freely". The advice to keep project rules in the root file stays. It now also gives the reason that this keeps upgrades merging cleanly.
- **Pointer from the scaffold.** No new line. The URL goes at the end of the existing stamp comment ("… from template changes. See https://shipbench.dev/docs/upgrading/"), so every future board carries it, and it stays invisible in rendered Markdown. `readScaffoldStamp` matches only the prefix, so reading the stamp doesn't change.
- **Unstamped files in `init`.** Reported now, because the page gives them a procedure: "`.shipbench/AGENTS.md` records no ShipBench version." Whenever `init` names a file, it adds "To update without losing your edits, see https://shipbench.dev/docs/upgrading/". Changeset: `shipbench` minor (`link-upgrade-procedure.md`).

Tested on a 0.10.0 project with review-gate edits, checked out with CRLF line endings, merged up to the current build. The README matched its base and was replaced. The AGENTS.md merged with no conflicts: every template change landed and every edit survived. A plain byte comparison fails on a CRLF checkout, so the page uses `git diff --no-index --ignore-cr-at-eol`.

This repo's own files stay unstamped until 0.11.0 publishes, because a source build stamps 0.10.0. On 2026-11-23 the README matched the current template exactly, and AGENTS.md differed only by this board's rules. Follow-up in backlog: stamp-this-repo-s-scaffolded-files-once-0-11-0-is-published.
