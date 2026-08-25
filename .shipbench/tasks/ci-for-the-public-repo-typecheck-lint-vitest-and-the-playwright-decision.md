---
title: 'CI for the public repo: typecheck, lint, vitest, and the Playwright decision'
status: todo
priority: medium
tags:
  - infra
  - testing
  - ci
created: '2026-08-22T20:35:23.143Z'
updated: '2026-08-22T20:35:23.143Z'
---

Nothing in this repo runs automatically yet. **The Playwright question is the actual decision here, not the YAML.**

## Why it matters more than it used to

While ShipBench was a private monorepo, "nothing runs automatically" was a tolerable limit: one person ran everything locally and knew when they hadn't. A public repo changes the stakes in two directions — a broken `main` is visible, and a published package built from unverified code is a different class of mistake than a broken local checkout.

It also becomes a prerequisite in practice, if not in `depends_on` — the release workflow lands in the same Actions setup, and publishing from a repo with no test signal is a choice worth making deliberately rather than by omission.

## Evidence: a red test can sit in `main` unnoticed

Found during the Board lib-mode review on 2026-08-16, in the monorepo: **`main` was carrying a failing test, and nobody noticed.**

`packages/board/src/ui/Board.test.tsx` asserted `toHaveClass` with the arbitrary-value Tailwind class `[field-sizing:content]`, while `DetailView.tsx` rendered the native utility `field-sizing-content`. Confirmed by restoring the old assertion and running it — it failed with a clear diff. It was fixed in passing by unrelated work; the failure predated that work.

The cost was low there because one person ran everything locally. The same red test on a public repo is visible, and a package published from it is a different class of mistake. Worth weighing when deciding how hard the workflow should gate.

It also sharpens the definition-of-done line below: the interesting case is not a test that fails loudly on a fresh run, it is one that has been failing for a while in a suite nobody watched.

## Scope

- A workflow on push and PR running `pnpm typecheck`, `biome lint`, and `pnpm test`. These are fast — the full vitest run measured ~15s on 2026-08-22 (660 tests across 31 files).
- **Decide whether the Playwright harness runs in CI.** It needs a production build plus a ~130 MB Chromium download, and its value is concentrated on site changes. Options: run it only when `apps/site/**` changes, run it on every PR and accept the cost, or leave it local-only and accept that browser regressions ship. Record the decision in `apps/site/e2e/README.md`, which currently states "nothing runs these automatically" as a known limit and will be wrong either way.
- If it does run in CI, revisit two deliberately local-only choices in `apps/site/playwright.config.ts`: `retries: 0` and `forbidOnly: false`. Both are right for a human at a terminal and wrong for a machine.
- Decide what a failing axe baseline should do to a PR. The baseline is fail-on-new-rule-only by design, chosen for a local runner; a machine enforcing it is a different contract.
- **Pin or police the lockfile.** CI should install with `--frozen-lockfile`. The split's own lockfile regeneration silently pulled a sonner patch release that broke a Board test — see `packages/board/src/test/setup.ts` — which is exactly the class of drift a lockfile-respecting CI catches on the PR that causes it.

## Definition of done

- Typecheck, lint, and vitest run automatically on push and PR.
- A documented, deliberate decision about Playwright, with `apps/site/e2e/README.md` updated to match.
- A deliberately failing test is shown to fail the workflow — the check is verified to check, not assumed to.
