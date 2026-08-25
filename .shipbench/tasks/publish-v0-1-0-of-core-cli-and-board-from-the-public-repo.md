---
title: 'Publish v0.1.0 of core, CLI, and board from the public repo'
status: todo
priority: medium
tags:
  - distribution
  - npm
depends_on:
  - publish-readiness-files-license-readmes-scoped-access-metadata
  - release-tooling-changesets-fixed-mode-and-the-provenance-publish-workflow
created: '2026-08-22T20:35:23.324Z'
updated: '2026-08-22T20:35:23.324Z'
---

The actual first publish — `@shipbench/core`, `shipbench`, and `@shipbench/board` at **v0.1.0**, synchronized, from this repo.

## Why this sits where it does in the arc

- **The CLI is the entry point.** Unpublished, `npx shipbench init` does not work and the convention is unreachable.
- **It gates the Harbor repo.** Harbor in its own private repo has no workspace and resolves `@shipbench/core` and `@shipbench/board` from the registry. Until this lands, the Harbor repo can be created but cannot build. That is the hard ordering constraint in the entire split.
- It does **not** gate the site deploy, which ships independently.

## Scope

- Claim the `@shipbench` scope and the unscoped `shipbench` name.
- Run the synchronized release through the changeset and Actions tooling from the previous task.
- **Post-publish smoke, on a machine that has never seen the source:**
  - `npx shipbench@0.1.0 init` in a throwaway directory scaffolds a valid `.shipbench/`.
  - `shipbench board` resolves the published `@shipbench/board` standalone bundle and serves the board.
  - A scratch React/Vite project installs `@shipbench/board` and renders `{ Board }` with styles — this is the case Harbor depends on, and the last chance to catch a lib-mode packaging fault before Harbor's repo is standing on it.
- Confirm all three show public access and attached provenance on the registry.

## Risk worth naming

This is the first genuinely **irreversible** step in the arc. Published versions cannot be meaningfully unpublished, the scope and package names are claimed permanently, and the license ships with the tarball. Everything before this point is a file copy that can be redone; this is not.

## Definition of done

- Three packages live on npm at v0.1.0, public, with provenance.
- Clean-machine `npx shipbench init` and `shipbench board` work end-to-end against the published artifacts.
- An out-of-workspace React consumer can render the published Board.
