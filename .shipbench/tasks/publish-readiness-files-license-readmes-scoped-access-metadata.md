---
title: 'Publish readiness: files, LICENSE, READMEs, scoped access, metadata'
status: todo
priority: medium
tags:
  - distribution
  - npm
created: '2026-08-22T20:35:23.053Z'
updated: '2026-08-22T20:35:23.053Z'
---

Make the three packages publishable. No publishing here.

This had to wait for this repo to exist: `repository`/`homepage`/`bugs` metadata and npm provenance both attest to a repo that must already be real.

## The landmine

**`@shipbench/core` and `@shipbench/board` are scoped packages, and npm defaults scoped packages to `restricted`.** Neither declares `publishConfig.access`. Both have a `publishConfig` block already — it does the src→dist swap and nothing else.

Without `"access": "public"`, the first publish either errors or tries to create a paid private package. This is a one-line fix that will otherwise surface at the single worst moment, mid-release.

`shipbench` (the CLI) is unscoped and unaffected.

## Verified current state

Re-checked 2026-08-22 against this repo, after the split:

- **No LICENSE anywhere in the repo.** Not at root, not in any package.
- **No README for `@shipbench/core`.** The CLI and `@shipbench/board` both have one — Board's arrived with the lib-mode work. Verify each reads as a published-package README rather than a repo README.
- **`files` is set only on `@shipbench/board`** (`["dist"]`). Core and the CLI have none, so publishing today ships source or omits `dist`.
- **No `license`, `repository`, `homepage`, or `bugs` on any of the three.**
- All three sit at version `0.0.1`; the first release targets `0.1.0`.

## Per package

- **`@shipbench/core`** — `files: ["dist"]`, `access: "public"`, metadata, README, LICENSE. The existing `publishConfig` src→dist swap is correct; extend it, don't replace it.
- **`shipbench` (CLI)** — `files: ["dist"]`, metadata plus `keywords`, LICENSE. `bin`, core-bundling via tsup `noExternal`, and version injection already work.
- **`@shipbench/board`** — `files` already covers `dist`; confirm that reaches **both** artifacts: the standalone bundle the CLI reads at runtime (`dist/standalone.html` + assets) and the compiled library. Plus `access: "public"`, metadata, LICENSE, and a README stating it is published for convenience rather than public use, per spec.

## Decided

- **License is MIT.** Permissive suits a convention meant to spread, and it is the lowest-friction choice for anyone adopting the `.shipbench/` format. Root LICENSE plus a copy in each published package's tarball.

## Open

- `homepage` points at `shipbench.dev`. The site may not be deployed yet — using the GitHub URL now and updating later is fine and explicitly not a blocker.

## Definition of done

- All three carry `files`, LICENSE, README, `access: "public"` where scoped, and repository/homepage/bugs metadata.
- `pnpm --filter <pkg> pack` produces a tarball containing `dist` and nothing stray — no `src`, no tests — and for Board, containing both the standalone bundle and the library.
- A dry-run publish of all three reports public access.
