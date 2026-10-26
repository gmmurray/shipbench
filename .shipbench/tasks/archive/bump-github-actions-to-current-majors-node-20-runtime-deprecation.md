---
title: Bump GitHub Actions to current majors (Node 20 runtime deprecation)
status: done
priority: medium
tags:
  - infra
  - ci
  - tech-debt
created: '2026-08-29T16:33:10.254Z'
updated: '2026-08-29T19:04:09.934Z'
---

Every action pinned across the three workflows is at least one major behind, which is what produces the runner warning:

> Node 20 is being deprecated. This workflow is running with Node 24 by default.

## Current state

Latest majors checked 2026-08-29 against each action's releases API:

| Action | Pinned | Latest |
| --- | --- | --- |
| `actions/checkout` | v4 | **v7** |
| `actions/setup-node` | v4 | **v7** |
| `actions/cache` | v4 | **v6** |
| `actions/upload-artifact` | v4 | **v7** |
| `pnpm/action-setup` | v4 | **v6** |
| `changesets/action` | v1 | **v2** |

Affects `.github/workflows/ci.yml`, `e2e.yml`, and `release.yml`.

## Two groups, and only one belongs here

**In scope — the five ordinary bumps.** `checkout`, `setup-node`, `cache`, `upload-artifact`, and `pnpm/action-setup`. Read each major's release notes rather than bumping blind; `setup-node` deserves the most attention because its `registry-url` behaviour writes the `.npmrc` that release auth depends on, and `cache` because key/restore semantics have changed across majors before.

**Out of scope — `changesets/action` v1 → v2.** That one belongs to `move-releases-to-npm-trusted-publishing-oidc-and-restore-provenance`, because v2 removed `NPM_TOKEN` `.npmrc` handling in favour of trusted publishing. Bumping it here without the OIDC work would break publishing. Leave it at v1 and let the other task move it.

## Why this was deliberately deferred

These were left alone during the v0.1.0 release on purpose. The first attempt had failed on npm auth, and bumping six action versions in the same push as the auth fix would have meant a failed retry with six candidate causes on the arc's only irreversible step. That reasoning expires now the release has landed — the deprecation is a runway, not a failure, but the runway is finite.

## Definition of done

- The five in-scope actions are on current majors across all three workflows.
- A real workflow run is green afterwards — including one that exercises the e2e path filter, which is the only place `cache` and `upload-artifact` are used.
- The Node 20 deprecation warning is gone from every job except any traceable to `changesets/action@v1`, which is expected until the trusted-publishing task lands.

## Task Updates

### 2026-08-29T18:54:56.007Z
Done 2026-08-29. Five actions bumped across all three workflows; changesets/action deliberately untouched at v1.

checkout v4 -> v7, setup-node v4 -> v7, cache v4 -> v6, upload-artifact v4 -> v7, pnpm/action-setup v4 -> v6.

**Release notes read rather than bumped blind, and three things were worth the reading.**

1. **setup-node v7 removed its dummy NODE_AUTH_TOKEN export.** That only matters when the variable is unset, and release.yml sets it explicitly, so this is safe. But it is the same subsystem that broke the first release attempt, so a comment now points there first if publish auth ever misbehaves again.

2. **setup-node v5 added automatic caching** keyed off package.json#packageManager, which this repo has. v6 then narrowed automatic caching to npm only, so it does not apply to pnpm and the explicit cache: pnpm input still governs. No change needed, but worth knowing why nothing broke. The pnpm/action-setup-before-setup-node ordering that cache: pnpm depends on is intact in all three workflows - verified rather than assumed.

3. **checkout v5-v7 carry a breaking change** around allow-unsafe-pr-checkout, blocking fork PR checkout for pull_request_target and workflow_run. Neither trigger is used here - the workflows run on push and pull_request - so it does not apply. fetch-depth is unchanged, which matters because release.yml depends on fetch-depth: 0 for changesets.

cache and upload-artifact were runtime bumps with no documented input changes; the key, path, name, retention-days, and if-no-files-found inputs in use are unaffected.

**Also corrected a comment that had become false.** release.yml's id-token: write said 'without this the publish still succeeds but ships unattested.' v0.1.0 published *with* it granted and still attached no attestations, so the comment was actively misleading about the guarantee. Rewritten to state that the permission is necessary but not sufficient, name the actual cause, and say to verify provenance against the registry rather than against a green workflow.

**Verification.** install --frozen-lockfile, typecheck, lint, 660 tests across 31 files, and build all exit 0 - the workflows only run these commands. YAML structure checked on all three; no tabs, on/jobs present, action counts as expected.

**Not verifiable from here:** whether the runner accepts these versions and whether the Node 20 warning is gone. Both need a real run. The e2e path filter means cache and upload-artifact only exercise on a change touching apps/site/** or pnpm-lock.yaml, so a push that changes neither will not prove those two.

**One thing found for later:** pnpm/action-setup v6.0.10 release notes point users to a successor, pnpm/setup. v6 is current and correct today, but the action appears to be on a deprecation path of its own. Worth revisiting rather than acting on now.
