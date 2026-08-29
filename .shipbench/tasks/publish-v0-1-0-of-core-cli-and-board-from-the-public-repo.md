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
updated: '2026-08-29T16:01:39.522Z'
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

## Task Updates

### 2026-08-29T16:01:39.522Z
First publish attempt failed 2026-08-29. Nothing was published - verified against the registry, all three names still return 404, so 0.1.0 is uncontaminated and no version number was burned.

**Cause, from one line of the log:** 'No NPM_TOKEN found, but OIDC is available - using npm trusted publishing'. changesets/action@v1 checks the env var named NPM_TOKEN to choose its auth strategy. The workflow set NODE_AUTH_TOKEN (which actions/setup-node's registry-url wires into .npmrc) but not NPM_TOKEN, so the action took the trusted-publishing path instead. Trusted publishing is not configured for these packages on npmjs.com, so the registry fell back to demanding an OTP and pnpm died with ERR_PNPM_OTP_NON_INTERACTIVE.

The OTP error reads like a 2FA problem but is not one: the token was never used at all. Fixed by adding NPM_TOKEN alongside NODE_AUTH_TOKEN, both pointing at the same secret.

**State to know before retrying.** The version pull request was merged, so origin/main carries 0.1.0 and the changeset is consumed. release.yml on the next push will find no changesets, fall through to 'publish any unpublished packages', and retry 0.1.0 directly. No new changeset and no version bump are needed.

**Provenance is unaffected by using a token.** Provenance and trusted publishing are separate mechanisms: NPM_CONFIG_PROVENANCE plus id-token: write signs the attestation, while NPM_TOKEN authenticates the publish. Both stay.

**If the retry still fails with an OTP error**, then the token itself is the problem - specifically a classic 'Publish' token rather than an 'Automation' token. Only automation tokens bypass 2FA on publish. That would be visible on npmjs.com under Access Tokens as the token's type.

**Action versions are deliberately not bumped in this change.** Every action in use is a major behind and that is the source of the Node 20 deprecation warning - checkout v4 vs v7, setup-node v4 vs v7, cache v4 vs v6, upload-artifact v4 vs v7, pnpm/action-setup v4 vs v6, changesets/action v1 vs v2. Bumping them in the same push as the auth fix would mean a failed retry has six candidate causes instead of one, on the arc's only irreversible step. The warning is a deprecation runway, not a failure.

changesets/action v2 in particular is not a drop-in: it renames every input this workflow uses (version -> version-script, publish -> publish-script, commit -> commit-message, title -> pr-title), stops honouring GITHUB_TOKEN as an env var in favour of a github-token input, and removes NPM_TOKEN .npmrc handling entirely in favour of trusted publishing - which would undo the fix above unless trusted publishing is configured first. That is its own task, worth doing after the first release lands.
