---
title: 'Release tooling: changesets fixed mode and the provenance publish workflow'
status: done
priority: medium
tags:
  - distribution
  - npm
  - ci
created: '2026-08-22T20:35:23.233Z'
updated: '2026-08-29T15:34:22.719Z'
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

## Task Updates

### 2026-08-29T15:31:11.066Z
Done 2026-08-29. Changesets in fixed mode plus the release workflow. Nothing published; the repo sits at 0.0.1 with one pending changeset.

**Fixed group verified, including the name collision.** changeset status reports all three going to 0.1.0 from one changeset. The workspace root is also named 'shipbench' and is private: true - it is correctly invisible to changesets, so only the CLI appears under that name. @shipbench/site is private too and equally invisible. Config declares access: public as well, which is belt-and-braces against the publishConfig.access work from the readiness task rather than a replacement for it.

**The version step was run for real, then reverted.** Not simulated: pnpm release:version bumped all three 0.0.1 -> 0.1.0, generated three CHANGELOGs, updated the lockfile, and consumed the changeset. The changed set was exactly the three package.json files plus the lockfile - nothing stray. Then reverted to 0.0.1 with the changeset restored, because the workflow has to own that bump: leaving the repo bumped would mean merging to main finds no changesets and publishes nothing while the versions already claim 0.1.0.

**The workspace:* rewrite, confirmed at the release version rather than at 0.0.1.** Packed at 0.1.0: shipbench pins @shipbench/board 0.1.0, @shipbench/board pins @shipbench/core 0.1.0, and both keep workspace:* in source. That is the load-bearing assumption this task called out; it now holds at the version that will actually ship.

**Provenance.** pnpm publish --help does not document --provenance, so rather than assume, I checked pnpm's CLI option table and found provenance declared as a typed Boolean - the flag is real, not silently ignored. The workflow still sets both the flag path and NPM_CONFIG_PROVENANCE=true, because changesets invokes the package manager on our behalf and the environment route survives that indirection. Setting both costs nothing; relying on one and being wrong ships an unattested first release, which is the kind of failure nobody notices. id-token: write is set - without it the publish still succeeds but unattested.

**Auth.** actions/setup-node writes an .npmrc that reads NODE_AUTH_TOKEN, wired to the owner's NPM_AUTOMATION_TOKEN secret. No token is written into the repository.

**Script naming.** The bump script is release:version, not the conventional 'version'. 'version' is an npm/pnpm lifecycle hook name and would fire on pnpm version; the workflow calls both scripts explicitly so nothing is lost by being unambiguous.

**One thing this task caught that would have broken CI.** Reverting the local version bump included git checkout of pnpm-lock.yaml, which reverted past the @changesets/cli install - leaving package.json declaring a dependency the lockfile did not have. pnpm install --frozen-lockfile exited 1, which is step one of every workflow. Regenerated and re-verified. Worth recording because it is the same class of drift the CI task's lockfile line exists to catch, and it appeared during ordinary local work rather than from a dependency bump.

**Verification.** install --frozen-lockfile, typecheck, lint, 660 tests across 31 files, and build all exit 0.

**Left for the owner.** The release flow is two merges: merging the pending changeset to main opens a 'chore: version packages' pull request; merging that publishes 0.1.0 with provenance. The first run is also the first real test of the token and OIDC wiring, so watch it rather than assuming. The npm names were verified unregistered on 2026-08-29 - shipbench, @shipbench/core, @shipbench/board all 404 - but that check is only as fresh as its date.
