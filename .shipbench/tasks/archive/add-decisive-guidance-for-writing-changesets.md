---
title: Add decisive guidance for writing changesets
status: done
priority: medium
tags:
  - release
  - docs
created: '2026-09-27T18:46:55.028Z'
updated: '2026-09-27T18:51:30.364Z'
---

Add decisive guidance for writing changesets. The current instructions cover whether a change needs one (`.changeset/README.md`) and give one line on tone (`docs/releasing.md`: write for someone deciding whether to upgrade). Nothing covers which packages to name, how to choose the bump, or what belongs in the text.

## What the published changelogs show (0.1.0 to 0.5.0)

- **Wrong audience.** A changeset's text goes into the changelog of every package it names. Core API detail (`Task.unreadableUpdates`, `TaskReadResult`) appears in the `shipbench` changelog that CLI users read.
- **Missing audience.** Board behaviour changes name `@shipbench/board` but not `shipbench`, although most people meet the board through `shipbench board`. The pending board-search changeset does this.
- **Buried breaking changes.** In 0.4.0, "`-C <path>` must precede the subcommand" is the last sentence of a paragraph about option parsing. In 0.5.0, a new required field on `TaskReadResult` that hosts must add isn't flagged as breaking.
- **Internal material.** Board task slugs, "still staged to follow-up tasks", review notes, and promises about future behaviour.
- **Length and voice.** Entries of 200 to 450 words that read like pull request descriptions, with the debugging story in dramatic phrasing.
- **No bump guidance.** The README explains how bumps combine, not how to choose one.

## Scope

- A "Writing a changeset" section in `.changeset/README.md` covering which packages to name, one audience per changeset, choosing the bump, the entry's structure and length, and what stays out.
- `docs/releasing.md` step 1 points to it, and its template stops recommending listing all three packages.
- The AGENTS.md CI line mentions that the README covers how to write a changeset.
- The pending board-search changeset is rewritten under the new rules, as a worked example.

Published changelogs are not rewritten. They are public history.

## Task Updates

### 2026-09-27T18:47:49.766Z
Done, ready for review. .changeset/README.md has a new section, Writing a changeset, with six parts:

- which packages to name, by reader, with board changes naming shipbench too;
- one changeset per audience;
- choosing the bump by what consumers have to do: minor for anything that can break someone before 1.0, and minor when unsure;
- structure: lead with the visible change, then what it means, and a **Breaking:** paragraph for anything a consumer must change;
- keeping it public: no board slugs, roadmap, or promises about later releases;
- a worked example.

docs/releasing.md step 1 now points to that section, and its template no longer lists all three packages at patch. The AGENTS.md CI line mentions the guidance. The pending board-search changeset is split into two under the new rules: board plus shipbench for the search box, and core for the new @shipbench/core/search subpath. changeset status still resolves to a 0.6.0 minor. Published changelogs are untouched.
