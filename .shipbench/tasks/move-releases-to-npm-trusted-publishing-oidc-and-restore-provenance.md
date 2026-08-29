---
title: Move releases to npm trusted publishing (OIDC) and restore provenance
status: todo
priority: high
tags:
  - distribution
  - npm
  - ci
  - security
created: '2026-08-29T16:33:10.150Z'
updated: '2026-08-29T16:33:10.150Z'
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
