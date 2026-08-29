---
title: Move releases to npm trusted publishing (OIDC) and restore provenance
status: done
priority: high
tags:
  - distribution
  - npm
  - ci
  - security
created: '2026-08-29T16:33:10.150Z'
updated: '2026-08-29T19:28:52.533Z'
---

Replace the long-lived npm token with GitHub OIDC trusted publishing, and get provenance attached — which it currently is not.

## v0.1.0 shipped without provenance

Verified against the registry on 2026-08-29, after the release landed:

```
shipbench@0.1.0        no attestations
@shipbench/core@0.1.0  no attestations
@shipbench/board@0.1.0 no attestations
```

`dist` carries only npm's own registry `signatures`, which every package gets. There is no `dist.attestations`, which is where provenance lives.

This is not cosmetic. "Provenance from release one: low cost, real trust signal" was an explicit requirement of the release-tooling task, the workflow set `NPM_CONFIG_PROVENANCE: true` and granted `id-token: write`, and it still did not happen. **It cannot be fixed retroactively** — attestations attach at publish time and a published version is immutable. 0.1.0 stays unattested forever; the goal is that 0.1.1 does not.

### Why it failed

The workflow reasoned that setting both `--provenance` and `NPM_CONFIG_PROVENANCE` was belt-and-braces. It wasn't. Changesets invokes `pnpm publish` itself, so the flag was never on the command line, and `NPM_CONFIG_PROVENANCE` is an **npm-CLI** environment convention that pnpm does not appear to honour. Nothing errored — provenance was simply skipped, which is precisely the "failure nobody notices" the workflow comment warned about.

Confirm the mechanism before fixing it rather than assuming this diagnosis is right.

## Two paths, and they are not equivalent

**Interim: make pnpm actually read the setting.** `provenance=true` in an `.npmrc` that pnpm reads is the cheap fix, and pnpm does read `.npmrc`. This restores provenance while keeping token auth. Worth doing only if trusted publishing is going to take a while — otherwise it is throwaway work.

**Destination: trusted publishing.** Provenance is automatic and mandatory under OIDC, so the interim fix stops being a separate concern. It also removes the long-lived credential entirely, which is the larger win: no token to rotate, leak, or forget.

## What trusted publishing requires

- Configure a trusted publisher for each of the three packages on npmjs.com, scoped to this repository and the specific workflow file. All three packages now exist, so this is configurable — it was not before the first publish, which is part of why the first attempt failed over to an OTP prompt.
- **`changesets/action` must move v1 → v2**, and this is a hard coupling rather than housekeeping: v2 *removed* `NPM_TOKEN` `.npmrc` handling specifically in favour of trusted publishing. Doing the OIDC work on v1 fights the action; doing the v2 upgrade without OIDC breaks auth.
- v2 renames every input this workflow uses. Verified from its release notes: `version` → `version-script`, `publish` → `publish-script`, `commit` → `commit-message`, `title` → `pr-title`, and `GITHUB_TOKEN` as an environment variable is no longer honoured — it must be passed as a `github-token` input.
- Once OIDC works, delete the `NPM_TOKEN` / `NODE_AUTH_TOKEN` environment entries and revoke the granular access token. Leaving a working token behind means the next failure silently falls back to it and nobody learns that OIDC broke.

## Note on the token that did work

The first release attempt failed with `ERR_PNPM_OTP_NON_INTERACTIVE`. The cause was the workflow setting `NODE_AUTH_TOKEN` but not `NPM_TOKEN`, so `changesets/action@v1` took an unconfigured trusted-publishing path. Adding `NPM_TOKEN` fixed the auth strategy; the publish then needed 2FA bypass enabled on the granular access token.

Recorded because the terminology matters for this task: **granular access tokens are npm's current mechanism** and classic "publish" / "automation" tokens are legacy. Guidance written against the old token types is out of date.

## Verifying this needs a real release

Provenance only exists on a published artifact, and `0.1.0` is immutable, so **this task cannot be confirmed without publishing `0.1.1`**. Nothing in `packages/` or `apps/cli/` has changed since the release (verified 2026-08-29), so that release carries no functional change.

Cut it anyway, with a changelog entry that says so plainly. The alternative — waiting for a real change to ride along with — means the first release after swapping the auth mechanism is also the first time anyone finds out whether it works, discovered midway through shipping something that mattered. A version number is cheap; an unverified release pipeline is not.

A prerelease under a `next` dist-tag would also attach provenance and avoid moving `latest`, if burning a patch version feels wrong. It costs changesets prerelease-mode setup for a one-time check, which is probably not worth it here.

## Definition of done

- Releases publish with no long-lived npm credential in the repository or its secrets.
- The next published version shows `dist.attestations` on the registry — checked against the registry, not inferred from a green workflow.
- `changesets/action` is on v2 with every renamed input updated and `github-token` passed as an input.
- The old token is revoked, not merely unused.

## Task Updates

### 2026-08-29T19:08:10.746Z
Workflow side done 2026-08-29. Two owner actions remain before a release can run, and they are blocking - detailed at the end.

**The make-or-break question, settled from pnpm's own changelog rather than assumed:** pnpm supports OIDC trusted publishing, and this repo is well past every relevant fix. 11.0.7 made trusted publishing take precedence over a static _authToken and attempt OIDC per package during recursive publish. 11.0.9 fixed pnpm publish --provenance returning 422. 11.1.3 fixed a 404 when OIDC ran alongside an actions/setup-node .npmrc containing an unresolved ${NODE_AUTH_TOKEN} placeholder - which is exactly this workflow's shape once the token is removed. 11.4.0 required provenance before treating trusted publisher metadata as strongest trust evidence. Pinned version is 11.21.0.

**That also explains v0.1.0 conclusively, replacing the earlier guess.** 11.0.7's behaviour is: OIDC when applicable, static token as fallback. Trusted publishing was not configured, so OIDC was not applicable, pnpm fell back to the token, and published without provenance. The failure was silent by design - fallback is a feature. Removing the token removes the fallback, so a broken OIDC setup now fails loudly instead of shipping unattested.

**Workflow changes.** changesets/action v1 -> v2 with every input renamed: version -> version-script, publish -> publish-script, commit -> commit-message, title -> pr-title, and GITHUB_TOKEN moved from env to a github-token input. NPM_TOKEN, NODE_AUTH_TOKEN, and NPM_CONFIG_PROVENANCE are all gone - there is no npm credential anywhere in the workflows now, verified by grep. setup-node's registry-url is kept for the registry setting; its .npmrc placeholder resolves to empty on pnpm 11.1.3+.

**Provenance now goes through .npmrc, not the environment.** provenance=true in a committed repository .npmrc. NPM_CONFIG_PROVENANCE is an npm-CLI convention pnpm ignores, which is why v0.1.0 shipped unattested despite it being set; pnpm does read .npmrc. Checked that .npmrc is not gitignored - a silently-ignored file would have defeated the entire fix.

Side effect, intended: pnpm publish from a laptop will now fail, because provenance needs a CI OIDC context. Documented in .changeset/README.md alongside the note that a failed release now means the trusted publisher config is wrong, not that a secret is missing.

**Verification possible from here:** install --frozen-lockfile, build, and 660 tests pass with the new .npmrc; no credential references remain in any workflow; v2 input names match the release notes. Everything else needs a real run.

**BLOCKING - owner actions, in this order.**

1. Configure a trusted publisher on npmjs.com for each of the three packages - shipbench, @shipbench/core, @shipbench/board. Package settings, publishing access, trusted publisher. Provider GitHub Actions, owner gmmurray, repository shipbench, workflow filename release.yml. All three need it individually; one missing entry fails that package only, mid-release, after the others have published.

2. Only after (1): add a changeset and cut 0.1.1. Then verify dist.attestations is present on the registry for all three - not that the workflow was green, which it also was for the unattested 0.1.0.

3. After 0.1.1 verifies: revoke the granular access token on npmjs.com and delete the NPM_AUTOMATION_TOKEN repository secret. Leaving a working credential behind means a future OIDC break silently falls back to it, which is the failure mode this task exists to remove.

### 2026-08-29T19:26:32.326Z
Verified 2026-08-29. 0.1.1 published through OIDC trusted publishing with provenance attached on all three packages.

**Independently confirmed against the registry, not inferred from a green workflow** - the distinction that mattered, since 0.1.0's workflow was also green and attached nothing.

All three at 0.1.1, dist-tag latest, each carrying two attestation bundles: npm's own publish attestation (specs/publish/v0.1) and SLSA provenance v1.

Decoded the shipbench@0.1.1 provenance payload rather than trusting the presence of the field, because provenance pointing at the wrong source would be worse than none:

  subject     pkg:npm/shipbench@0.1.1
  buildType   slsa-framework.github.io/github-actions-buildtypes/workflow/v1
  workflow    repository https://github.com/gmmurray/shipbench
              path       .github/workflows/release.yml
              ref        refs/heads/main
  builder     https://github.com/actions/runner/github-hosted

The workflow path in the attestation confirms the trusted publisher matched the intended source rather than merely accepting the publish.

**Credential removed.** Owner revoked the granular access token on npmjs.com and deleted the NPM_AUTOMATION_TOKEN repository secret. There is now no long-lived npm credential in the repository, its secrets, or the workflows - so a future OIDC failure has nothing to silently fall back to, which was the specific failure mode this task existed to eliminate.

**Definition of done, against the original list.** No long-lived credential: met. dist.attestations verified on the registry: met, all three. changesets/action on v2 with renamed inputs and github-token passed as an input: met. Old token revoked rather than merely unused: met.

**What stays permanently true:** 0.1.0 remains unattested. Attestations apply at publish time and published versions are immutable, so that version is a permanent record of the gap. 0.1.1 onward carry provenance.
