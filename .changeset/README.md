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

Releases run from `.github/workflows/release.yml`, not from a laptop. Merging a
changeset to `main` opens a "Version Packages" pull request; merging *that* pull
request publishes. Provenance is attached via GitHub OIDC, which only works when
the publish runs in Actions — a local `pnpm publish` would produce an
unattested tarball.
