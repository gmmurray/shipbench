---
title: 'Publish readiness: files, LICENSE, READMEs, scoped access, metadata'
status: done
priority: medium
tags:
  - distribution
  - npm
created: '2026-08-22T20:35:23.053Z'
updated: '2026-08-29T14:50:13.378Z'
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

## Task Updates

### 2026-08-28T18:45:25.528Z
Done 2026-08-28. All three packages are publishable; nothing published.

**The landmine is closed.** publishConfig.access: public added to @shipbench/core and @shipbench/board, extending the existing src->dist blocks rather than replacing them. Verified the way that actually matters: the packed tarball's package.json carries it, which is what npm reads at publish time. Note the definition-of-done line asking for a dry-run that 'reports public access' cannot be satisfied literally - pnpm publish --dry-run prints only the package and registry, not access. Dry run exits 0 for all three; the tarball check is the stronger evidence.

**LICENSE.** MIT, copyright holder gmmurray (owner's call), at the root and copied into all three packages. Present in every tarball.

**Metadata.** license, repository (with the monorepo directory field), homepage, bugs, keywords, and description on all three. description was not in the task list but every npm page renders it as the subtitle and all three were blank; the CLI carries the canonical descriptor per the branding doctrine. homepage points at the GitHub README rather than shipbench.dev deliberately - the site is not deployed, and a dead homepage link on an npm page is worse than a repo link. Flip it when the site ships.

**files.** Added to core and the CLI; Board already had it. Tarballs verified by extraction, not assumption: core is LICENSE + README + dist (no src, no tests), the CLI is LICENSE + README + dist/index.js, and Board carries both artifacts - standalone.html plus hashed assets for the CLI, and index.js + styles.css + declarations for library consumers.

**workspace:* rewrite confirmed.** The packed tarballs pin @shipbench/core to 0.0.1 for both Board and the CLI, and Board ships react/react-dom as peers. That is the release-tooling task's load-bearing assumption, now evidenced rather than trusted.

**READMEs. The CLI's was the real find.** It was a contributor document - src/ layout, tsup internals, 'adding a new command' - and since files: [dist] means the README is the only doc that ships, that was the entire npm page. It also still described 'shipbench board' as a stub, which it has not been for some time. Rewrote it as a package README (install, quickstart, verified command table, agent workflow, convention primer) and moved the development content to apps/cli/CONTRIBUTING.md rather than deleting it - the tsup gotchas are real engineering knowledge. Wrote packages/core/README.md from scratch against its actual export surface. Board's README gained the 'published for convenience, not for public use' framing the spec calls for.

**Verification.** pnpm build, typecheck, biome lint (168 files), and 660 tests across 31 files all pass.

**Two observations for the publish task, neither fixed here.** (1) The CLI ships @shipbench/core as a runtime dependency even though tsup bundles it via noExternal, so a global install pulls core twice. Board must stay - the CLI resolves its package.json to find the standalone bundle - but core looks removable. Not touched because verifying it is a build concern, not a metadata one. (2) Board's tarball includes .d.ts.map files whose sources are not shipped, so consumer go-to-definition resolves to nothing. Harmless, and arguably an argument for declarationMap: false.

### 2026-08-28T19:30:12.500Z
Follow-up 2026-08-28, on the owner's call: homepage set to shipbench.dev, and both deferred observations fixed rather than passed to the publish task.

**homepage -> https://shipbench.dev** on all three. The earlier GitHub-URL choice hedged against the site not being live; the owner is publishing the site alongside the packages, so the hedge is unnecessary and the canonical home is correct.

**@shipbench/core moved out of the CLI's runtime dependencies.** Verified removable before touching it rather than reasoning from the tsup config: the built bundle's only bare imports are child_process, chokidar, commander, fs, fs/promises, module, path, process - zero @shipbench/core references, because noExternal inlines it. The single @shipbench/board reference is real and must stay: resolveBoardBundleDir calls require.resolve('@shipbench/board/package.json') to locate dist/standalone.html at runtime.

Moved to devDependencies rather than deleted - the source imports it and tsup needs it at build time. Post-change evidence: bundle is 264.67 KB (was 264.68), still zero core references, and shipbench board serves GET / -> 200 with the root mount node. The shipped tarball now declares chokidar, commander, and @shipbench/board only, so a global install no longer pulls core twice.

**declarationMap disabled for Board's library build.** packages/board/tsconfig.lib.json had declarationMap: true, emitting .d.ts.map files whose sources are excluded by files: [dist]. Consumers got go-to-definition that resolved to nothing. Set false with the reasoning in a comment beside it, since the next person to see a declaration build without maps will otherwise assume it was an oversight. Repacked tarball contains zero .d.ts.map.

**Verification after all three:** pnpm install, build, typecheck, biome lint (168 files), 660 tests across 31 files. Tarballs re-inspected: homepage correct on all three, Board still carries both artifacts, no stray src or tests.
