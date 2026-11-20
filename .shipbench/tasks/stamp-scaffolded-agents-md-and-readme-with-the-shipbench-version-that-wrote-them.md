---
title: >-
  Stamp scaffolded AGENTS.md and README with the ShipBench version that wrote
  them
status: done
priority: medium
tags:
  - convention
  - agents
  - dx
created: '2026-10-27T22:35:10.104Z'
updated: '2026-11-20T22:46:29.444Z'
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

## Task Updates

### 2026-11-20T22:41:18.288Z
Implemented. How each open question in "Shape to settle" was decided:

- **Where the stamp goes.** It's the first line of README.md and AGENTS.md, followed by a blank line: `<!-- shipbench-scaffold <version>: keep this line. It records the ShipBench version that wrote this file, so an upgrade can tell your edits from template changes. -->`. `readScaffoldStamp` matches `shipbench-scaffold <version>:` on the first line only and tolerates a BOM. A stamp moved anywhere else reads as no stamp, because a merge needs to trust the first line. Config, layout, and the welcome task stay unstamped. Nothing merges them.
- **No base hash.** The procedure regenerates the base with `npx shipbench@<version>` anyway, to merge against it, and a byte comparison with that base answers "unedited" without a second token. A hash would only save the npx call for an unedited file. Hashing a file that contains its own stamp also needs a rule about what is hashed. Not worth it yet.
- **What generation depends on.** The version comes from the host: `initProject` takes a required `version`, and the CLI passes its build version. Core can't know its own version from source, and `npx shipbench@<v>` is the command that regenerates the base, so the CLI's version is the right token. With the three packages in a fixed group, the CLI and core versions are the same anyway. The name stays out of the stamp because `config.json` `name` already records it. A project that renames itself later regenerates a base with the wrong heading, and that conflict is easy to resolve.
- **Reporting.** Only `init` on an existing project reports, saying "`.shipbench/AGENTS.md` was written by ShipBench 0.4.0; this is 0.11.0." Unstamped files are not reported: today that's every existing project, and the message would have no procedure to point at until the docs follow-up lands. That follow-up should decide whether unstamped files get a line too.

Caveats:
- A CLI built from an unreleased `main` stamps the version in package.json, whose published template may differ. Only source builds can produce that, so I left it.
- This repo's own `.shipbench/AGENTS.md` and README stay unstamped. Their base doesn't match any published version, so any stamp would be a guess. Stamping them belongs to the docs task's test run.

Changesets: `shipbench` minor (scaffold and init output) and `@shipbench/core` minor (required `version`, new `scaffold` result field, `readScaffoldStamp`).
