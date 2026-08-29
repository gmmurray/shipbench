# Changesets

This directory holds unreleased change descriptions. Each `.md` file here is one
pending change; `changeset version` consumes them all, rewrites the versions and
changelogs, and deletes them.

```bash
pnpm changeset          # describe a change (interactive)
pnpm changeset:status    # what would be released, and at what bump
```

## Fixed mode — read this before adding a package

`@shipbench/core`, `@shipbench/board`, and `shipbench` are a **fixed group**:
they always release together at the same version, whether or not each one
changed. This is the Angular/Astro/Next model, and it is deliberate — a
compatibility matrix between core and CLI versions is a support burden that a
solo project should not carry, and "which core does CLI 0.4 want?" should never
be a question anyone has to ask.

The practical consequence: a patch to core alone still bumps all three, and two
of the three releases will have an empty changelog entry for that version. That
is the cost, and it is the intended trade.

If a fourth publishable package is ever added, decide explicitly whether it
joins the fixed group. Leaving it out is fine; forgetting to decide is not.

`@shipbench/site` and the workspace root are `private: true` and are invisible
to changesets — they are never versioned or published.

## Releasing

**[docs/releasing.md](../docs/releasing.md) is the operational reference** —
step-by-step, the trusted publisher configuration, how to verify a release, and
what each failure mode means. The summary:

Releases run from `.github/workflows/release.yml`, not from a laptop. Merging a
changeset to `main` opens a "Version Packages" pull request; merging *that* pull
request publishes.

**There is no npm token.** Authentication is GitHub OIDC exchanged for a
short-lived registry credential, against a trusted publisher configured per
package on npmjs.com. A local `pnpm publish` will fail rather than produce an
unattested tarball, because `provenance=true` in the repository `.npmrc`
requires a CI OIDC context. That failure is intended.

If a release ever fails to authenticate, the cause is the trusted publisher
configuration on npmjs.com — repository, workflow filename, or both — not a
missing secret. There is deliberately nothing to fall back to.
