---
title: 'Release tooling: changesets fixed mode and the provenance publish workflow'
status: todo
priority: medium
tags:
  - distribution
  - npm
  - ci
created: '2026-08-22T20:35:23.233Z'
updated: '2026-08-22T20:35:23.233Z'
---

The release machinery for synchronized versioning across the three published packages.

## Why it had to be this repo

npm provenance attests to the repository and workflow that built the tarball, via OIDC. A package published from the private monorepo would carry an attestation pointing at a repo nobody can see, which inverts the entire point of provenance as a trust signal.

That is the concrete reason the split preceded the publish rather than the other way round.

## Scope

- **Changesets in fixed/lockstep mode** so `@shipbench/core`, `shipbench`, and `@shipbench/board` always release at the same version — the Angular/Astro/Next model, per spec Distribution. The fixed group is exactly those three; they are the only publishable packages here.
- Rely on `pnpm publish`'s `workspace:*` → pinned-version rewrite at publish time. Changesets manages version and changelog; pnpm handles the workspace rewrite. Both the CLI and Board depend on core via `workspace:*` today, so this rewrite is load-bearing, not incidental — verify it in the dry run rather than trusting it.
- **GitHub Actions publish workflow** with npm provenance via OIDC, an automation token, and 2FA. Provenance from release one: low cost, real trust signal.
- Shares an Actions setup with the CI task. Land them near each other; neither subsumes the other, since this runs on release and does not run tests.
- First release target: **v0.1.0** across all three.

## Prerequisites outside the repo

- The `@shipbench` npm scope and the unscoped `shipbench` name were both verified unregistered at spike time. Re-verify — that check is months old and names are first-come.
- An npm automation token with publish rights, stored as a repository secret.

## Definition of done

- A changeset-driven release produces a synchronized version bump and changelog across the three packages and nothing else.
- The workflow publishes successfully in dry run, with provenance attached and `workspace:*` correctly rewritten to pinned versions in the resulting tarballs.
