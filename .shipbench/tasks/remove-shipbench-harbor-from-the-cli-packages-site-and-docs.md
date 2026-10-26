---
title: 'Remove ShipBench Harbor from the CLI, packages, site, and docs'
status: done
priority: medium
tags:
  - harbor
  - cli
  - core
  - site
  - docs
created: '2026-10-26T00:28:10.641Z'
updated: '2026-10-26T01:33:05.910Z'
---

ShipBench Harbor is retired. The decision and its reasons are in [the Harbor-role spike](archive/spike-define-harbor-s-contribution-to-choosing-and-resuming-projects.md). Remove Harbor's surface from this repository so the CLI, packages, site, and docs describe only what exists.

Harbor was never deployed, so nothing here has to keep working for it. The site already hides it behind `HARBOR_ENABLED = false`, and that gate goes too.

## CLI

- Remove `shipbench connect` and `init --harbor`: [harborConnect.ts](../../apps/cli/src/harborConnect.ts) and its tests, their wiring in `cli.ts`, the Harbor cases in `cli.test.ts` and `cli.git.integration.test.ts`, and the Harbor line in `formatInitNextSteps` (`output.ts`).
- `CliExitError` lives in `harborConnect.ts`, and `index.ts` imports it. Move it if anything else still throws it. Exit codes 3 and 4 exist for the Harbor POST, so check whether anything else uses them before keeping them.
- Reword the Harbor mentions in `CONTRIBUTING.md` and the `tui/text.ts` comment.

## Core

- `normalizeGithubRemoteUrl` has no caller once `connect` is gone, so remove it and its export. **Keep `parseGithubRemoteUrl`.** Radar uses it for project identity.
- `GitHubAdapter` and `GitHubApiError`: Harbor was their only consumer. The recommendation is to remove them, with `adapters/github.ts` and its tests, but that shrinks the documented two-adapter surface, so confirm with the owner first.
- Keep `ReadableStorageAdapter`, because the TUI uses it. Reword its doc comment in `types.ts`.
- In `init.ts`, reword the seed-commit comment (it batches writes "for Harbor's onboarding flows") and the scaffolded README text that names Harbor: the "Harbor â€”" bullet, "CLI, Board, Harbor", and "Harbor and fresh clones". `.shipbench/README.md` mirrors that scaffold, so update it to match. This touches the same generated files as [updating-shipbench-init-with-new-versions](updating-shipbench-init-with-new-versions.md), so check that task's state before editing them.

## Board

Keep `readOnly` and `resolveRepoLink`. They are generic host hooks and cost little to keep. Where comments, `README.md`, or [docs/board/design.md](../../docs/board/design.md) name Harbor as the host, say "a host" instead, and drop the Remote board mode that only Harbor provided. `@shipbench/board` still needs publishing: the CLI uses its standalone bundle, and Radar consumes it from npm.

## Site

Delete `HARBOR_ENABLED` and everything that reads it: [flags.ts](../../apps/site/src/config/flags.ts) (delete the file if nothing is left in it), `satteri-harbor-gate.mjs` and `harbor-gate.test.ts`, its wiring in `astro.config.mjs` and `docs.ts`, `harborUrl` in `site.ts`, the landing page's Harbor section and its CSS, the Header and Footer links, and the Harbor references in `docs-routes.test.ts`, `SearchDialog.test.ts`, and `e2e/built-output.spec.ts`. Delete `docs/harbor.md`, and delete every `:::harbor` block in the docs content along with its contents. Check the remaining mentions in `BaseLayout.astro`, `IconSymbols.astro`, and `ThemeToggle.svelte`.

## Docs

- **AGENTS.md:** the product overview, which becomes one product plus the site. In Naming and branding: the "ShipBench Harbor" product name, the client framing, the `@shipbench/harbor` package line, the `harborEnabled` line, and the `harbor.shipbench.dev` domain line. Also the dependency-graph note, the "ShipBench Harbor â€” a consumer" section, and the Cloudflare and multi-account bullets under Architectural boundaries. The board-publishing rationale needs a new example of an out-of-repository host. Ask the owner whether to name Radar or keep it generic.
- **[docs/spec.md](../../docs/spec.md):** section 5, the Remote row of the board-modes table, the `GitHubAdapter` scope note, the `connect` and `init --harbor` command entries, "Harbor opt-in", and "Signed Harbor connection preflight". Add a non-goal recording that ShipBench has no hosted client, and link the spike.
- Also: `docs/design-doctrine.md`, `docs/why.md`, `docs/brand/README.md`, the root `README.md` Harbor bullet, and `.changeset/README.md`. In the site docs: `cli-reference.md`, `convention-spec.md`, `overview.md`, and `recipe-gitignore-layout.md`.
- Leave historical records alone: `docs/audits/`, the CHANGELOGs, and `tasks/archive/`.

## Board tasks

- Archive [refuse-to-connect-a-board-below-the-repository-root-to-harbor](archive/refuse-to-connect-a-board-below-the-repository-root-to-harbor.md). It's moot once `connect` is gone.
- Archive the Harbor-role spike once the owner marks it done.
- Edit the live tasks that still assume Harbor: [document-running-several-shipbench-boards-in-one-repository](document-running-several-shipbench-boards-in-one-repository.md) (the "Harbor shows only the root board" bullet and the `connect` clause), [keep-links-between-tasks-working-when-a-task-is-archived](keep-links-between-tasks-working-when-a-task-is-archived.md) ("and Harbor through `resolveRepoLink`"), option 6 of [updating-shipbench-init-with-new-versions](updating-shipbench-init-with-new-versions.md) ("Harbor's read-only view"), and the Harbor comparison and boundary deliverables in [the local-workbench spike](spike-explore-a-local-workbench-across-shipbench-repositories.md). Now that Radar exists, that spike probably needs re-scoping, but that is the owner's separate call.
- Leave done tasks as they are. Also leave the cross-project reporting spike's "Harbor as an inbox" rejection, which still records why that path was ruled out.

## Release

Removing `connect`, `init --harbor`, and core exports is a breaking change. Add a minor changeset for the fixed group that names the removed command, flag, and exports.

## Acceptance

- `shipbench connect` is an unknown command, and `shipbench init --harbor` is rejected as an unknown option.
- Outside `docs/audits/`, the CHANGELOGs, and `tasks/archive/`, the only Harbor mentions left are the spec's non-goal and other deliberate references to the decision.
- `pnpm typecheck`, lint, test, and build pass, and the site's Playwright suite passes.
- A changeset is present.

Work outside this repository (archiving the private Harbor repository, removing its Cloudflare, Clerk, and DNS resources) belongs to the owner and isn't part of this task.

## Task Updates

### 2026-10-26T00:34:55.588Z
Owner decisions: remove GitHubAdapter and GitHubApiError. Don't name Radar anywhere public; it's a personal extension built on ShipBench, not a ShipBench product, so the board-publishing rationale stays generic (an out-of-repository host).
