# Changesets

This directory holds unreleased change descriptions. Each `.md` file here is one
pending change; `changeset version` consumes them all, rewrites the versions and
changelogs, and deletes them.

```bash
pnpm changeset          # describe a change (interactive)
pnpm changeset:status    # what would be released, and at what bump
```

## When a change needs a changeset

Add a changeset when a published package changes behavior that consumers can
observe. This includes runtime behavior, CLI output, public APIs, and files the
package generates or scaffolds.

Do not add a changeset for changes limited to private packages, the site,
repository-only documentation, tests, or internal refactoring that leaves
published behavior unchanged. Repository tooling also needs no changeset unless
it changes a published artifact.

When a change spans both categories, decide from the published part.

## Writing a changeset

The text you write is published as-is: it becomes the entry in each named package's `CHANGELOG.md`, on npm and GitHub. Write it for someone deciding whether to upgrade, not for the commit log or the task board.

### Name the packages whose users will notice

Naming a package puts the entry in that package's changelog. Packages you leave out still get the version bump, because the three are a fixed group (see below), but their changelog only says "Updated dependencies". So choose by reader:

- **`shipbench`**: anything a CLI user sees. That includes a command, flag, or output, a file `shipbench init` scaffolds, and the board, which people mostly reach through `shipbench board`.
- **`@shipbench/core`**: a change to the library's exported API or its behaviour for code that calls it.
- **`@shipbench/board`**: a change to the embeddable component's props, exports, or behaviour for a host such as Harbor.

A board behaviour change therefore usually names both `@shipbench/board` and `shipbench`.

### Write one changeset per audience

When one change affects CLI users and library consumers differently, write two changesets. One names `shipbench` and describes commands and output. The other names `@shipbench/core` (or `@shipbench/board`) and describes the API. Each changelog then reads for its own audience. A CLI user shouldn't have to read past `TaskReadResult` to find the flag that changed.

### Choose the bump by what consumers have to do

Before 1.0:

- **`minor`**: a new capability, or anything that can break someone. That includes a renamed or removed flag or export, output a script might parse that now looks different, a changed meaning for an existing field, and a new required field on a type hosts construct.
- **`patch`**: a fix or change that asks nothing of anyone.
- **`major`**: not used before 1.0.

If you're unsure between `patch` and `minor`, choose `minor`. An honest minor is cheaper than a patch that breaks someone.

### Structure

1. **Start with what changed**, in terms the reader uses: a command, flag, output, or export. No preamble.
2. **Then what it means for them**: how to use it, and anything they now have to do differently.
3. **Mark anything that can break them** with a paragraph that starts `**Breaking:**` and says what to change. Don't leave it at the end of a paragraph about something else.
4. **Explain the cause only if it helps the reader judge the change**, in a sentence or two. Leave out the debugging story.

Most entries fit in one to three short paragraphs, well under 150 words. Go longer only when a consumer has a migration to perform.

### Keep it public

- **No board material.** Leave out task slugs, task titles, review notes, and "staged for a follow-up task". The changelog records what shipped, not what's planned.
- **No promises.** Don't describe what a later release will do.
- **Only public names.** Name what a consumer can see or import, not internal files or helpers.
- **Plain voice.** Short, specific sentences. Say what happened without dramatizing it.

### Example

One change, split for its two audiences:

```markdown
---
'shipbench': minor
---

`shipbench task search` ranks results by relevance instead of board order. Title matches rank above tags, tags above the description, and the description above Task Updates.

`--limit` no longer drops matches silently. Text output ends with `… N of M matches not shown`, and `--json` adds `total_matches`.
```

```markdown
---
'@shipbench/core': minor
---

`searchTasks` returns matches ranked by relevance instead of in input order. A more recently `updated` task wins a tie.

**Breaking:** callers that relied on `searchTasks` preserving input order should sort the results themselves.
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

## The bump is a ceiling, not a count

Coming from hand-versioning a single file, it's natural to expect the version
number to track *how much changed* — every edit is a release, so 1.0 → 1.1
vs. 1.0 → 2.0 ends up being a gut call about the size of that one diff.

Changesets decouples the two. Commits and PRs are one stream — code changes
constantly. Changesets are a second stream that only crystallizes into an
actual version number at the moment the version PR gets merged. Whatever
accumulated on `main` in between collapses into a single bump, and that bump
is the *highest* severity among the pending changesets, not a sum of them.

50 patch changesets merged over months still publish as one patch bump
(`0.0.1`) the day the version PR lands — 50 safe changes are still just
"safe, no action needed" to a consumer, no matter how many there were. Drop
one minor changeset into that same batch and the whole release becomes a
minor bump; the 50 patches don't add anything on top; they're absorbed. One
major does the same thing to a batch of 100 minors and patches. The version
number reports the riskiest promise being made to consumers in the batch, not
the volume of work that produced it.
