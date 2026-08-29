# Releasing

How `@shipbench/core`, `@shipbench/board`, and `shipbench` get to npm.

This is the operational reference. The *reasoning* behind lockstep versioning
lives in [.changeset/README.md](../.changeset/README.md) and is not repeated
here.

## The shape of it

A release is **two merges**, not one:

```
add a changeset ──► merge to main ──► "chore: version packages" PR opens
                                              │
                                              ▼
                                       merge that PR ──► published
```

`.github/workflows/release.yml` runs on every push to `main` and decides which
half it is doing:

- **Pending changesets exist** → runs `release:version`, which bumps versions,
  writes changelogs, deletes the consumed changesets, and updates the lockfile.
  Opens or updates the version pull request. Touches npm not at all.
- **No pending changesets** → runs `release:publish`, which builds and publishes
  anything not already on the registry.

A push with no changesets and nothing unpublished is a clean no-op. You will see
the workflow run on unrelated commits; that is expected.

## Cutting a release

**1. Add a changeset.**

```bash
pnpm changeset          # interactive: pick packages, pick a bump, write a summary
pnpm changeset:status   # what would be released, and at what version
```

The summary becomes the public changelog entry. Write it for someone deciding
whether to upgrade, not for the commit log.

If the interactive prompt is unavailable — an agent, a non-TTY shell — write the
file by hand. A changeset is just markdown in `.changeset/`:

```markdown
---
'@shipbench/core': patch
'@shipbench/board': patch
'shipbench': patch
---

What changed, and why a consumer would care.
```

All three are a fixed group, so listing one bumps all of them. Listing all three
explicitly is clearer about intent.

**2. Commit and push to `main`.** The version pull request opens within a minute.

**3. Review the version pull request.** This is a real review point, not a
rubber stamp. Check that the version moved the way you expected and that the
changelog entries read correctly — this is the last look before the text is
public and the version is permanent.

**4. Merge it.** That publishes.

## Authentication: there is no token

Releases authenticate through **GitHub OIDC trusted publishing**. The workflow
holds no npm credential, and no npm token exists in repository secrets. A
short-lived registry credential is minted per run, and npm verifies it against a
trusted publisher registered on each package.

This is not only tidier than a token — it removes a silent failure mode.
pnpm 11.0.7+ attempts OIDC and *falls back to a static token when OIDC is not
applicable*. With a token present, a broken OIDC setup publishes successfully
and unattested, and nobody notices. With no token, it fails loudly.

### The trusted publisher configuration

**This exists only in npm's web UI and is not reproducible from anything in this
repository.** Recorded here so it can be rebuilt.

Each of the three packages is configured individually, under
*Settings → Publishing access → Trusted publisher* on npmjs.com:

| Field | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization or user | `gmmurray` |
| Repository | `shipbench` |
| Workflow filename | `release.yml` |

All three need their own entry. A missing one fails **that package only**,
partway through a release, after the others have already published — leaving a
version live for two of three packages that cannot be republished.

Reconfigure whenever any of these change: renaming the repository, renaming or
moving the workflow file, moving to a different account, or adding a fourth
published package.

## Provenance

Every published version carries two attestations: npm's publish attestation and
[SLSA](https://slsa.dev) provenance, which records the repository, workflow
path, commit ref, and builder that produced the tarball.

Provenance is enabled by `provenance=true` in the repository
[`.npmrc`](../.npmrc) — **not** by `NPM_CONFIG_PROVENANCE` in the workflow.
That environment variable is an npm-CLI convention that pnpm ignores. `v0.1.0`
shipped with it set, a green workflow, and no attestations at all, which is why
the setting now lives somewhere pnpm actually reads.

The consequence for local work: `pnpm publish` from a laptop fails, because
provenance requires a CI OIDC context. That is intended. Releases run from the
workflow.

`v0.1.0` remains permanently unattested — attestations apply at publish time and
published versions are immutable.

## Verifying a release

**Check the registry, not the workflow.** A green workflow is not evidence; the
run that shipped `0.1.0` without provenance was green.

```bash
npm view shipbench@<version> dist.attestations
npm view @shipbench/core@<version> dist.attestations
npm view @shipbench/board@<version> dist.attestations
```

Each should return a `url` and a `provenance.predicateType`. Nothing returned
means the version published unattested and cannot be fixed — only superseded.

To confirm the provenance points at the right source rather than merely existing,
fetch the attestation and decode its payload; the `workflow` object should name
this repository and `.github/workflows/release.yml`.

Then a functional check from a directory that has never seen the source:

```bash
npx shipbench@<version> init      # scaffolds .shipbench/
npx shipbench@<version> board     # serves the board from the published bundle
```

The second one matters more than it looks: it is the only check that exercises
the CLI resolving `@shipbench/board` from the registry and serving its standalone
bundle. That packaging path has no test coverage.

## When it goes wrong

**`ERR_PNPM_OTP_NON_INTERACTIVE`** — the registry asked for a one-time password,
meaning the publish was not authenticated as it expected. Under trusted
publishing this points at the trusted publisher configuration: a missing entry,
or a mismatched repository or workflow filename. It does not mean a secret is
missing; there is deliberately no secret.

**Published, but no attestations** — the publish authenticated some other way, or
`provenance=true` did not reach pnpm. Check that `.npmrc` is present and not
gitignored, and that no npm token has been reintroduced into the workflow.

**Some packages published, others failed** — versions are immutable, so the
succeeded ones keep that version. Fix the cause and release the *next* patch
version; do not try to reclaim the partial one.

**The version pull request does not open** — there are no pending changesets in
`.changeset/`. Check with `pnpm changeset:status`.

## Adding a publishable package

Nothing enforces this list; it is the accumulated shape of what `publish
readiness` had to fix.

- `files` limiting the tarball to build output. Verify with `pnpm pack` and read
  the file list — no `src`, no tests.
- `publishConfig.access: "public"` if the name is scoped. npm defaults scoped
  packages to restricted, and the failure surfaces mid-release.
- `LICENSE` and a `README.md` written for the npm page rather than for
  contributors — for packages using `files`, the README is the *only* document
  that ships.
- `license`, `repository` (with `directory`), `homepage`, `bugs`, `description`,
  `keywords`.
- A decision about the fixed group in
  [.changeset/README.md](../.changeset/README.md).
- **A trusted publisher entry on npmjs.com**, per the table above. This is the
  step with no local signal that it was forgotten.
