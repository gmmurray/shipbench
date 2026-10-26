---
title: 'CI for the public repo: typecheck, lint, vitest, and the Playwright decision'
status: done
priority: medium
tags:
  - infra
  - testing
  - ci
created: '2026-08-22T20:35:23.143Z'
updated: '2026-08-29T15:21:35.373Z'
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

## Task Updates

### 2026-08-29T15:10:40.810Z
Done 2026-08-29. Two workflows, plus the Playwright decision the task said was the real work.

**The Playwright decision: run it, path-filtered. This turned out to be a fact rather than a judgment call.** apps/site declares no @shipbench/* dependency and imports none - verified both ways. So a change to core, board, or the CLI cannot alter the site's browser behaviour, and running the harness on those pull requests would spend a production build plus a Chromium download to learn nothing. That reframes the option the task posed as a cost compromise into the only one with a defensible signal.

Filter is apps/site/**, pnpm-lock.yaml, and the workflow file, plus workflow_dispatch for the case a filter cannot predict. pnpm-lock.yaml is in there deliberately: everything this harness verifies lives in astro, pagefind, and svelte, so a dependency bump is a real way for site behaviour to change with no file under apps/site/ moving. That is the same shape as the sonner incident.

**.github/workflows/ci.yml** - unconditional on push to main and every PR: install --frozen-lockfile, typecheck, lint, test, build. Build is included because the CLI bundles core and Board writes two outputs into one dist/, neither of which the test suite exercises; a packaging break should surface here rather than at release. pnpm/action-setup reads the pinned packageManager from package.json so CI cannot drift from local.

**.github/workflows/e2e.yml** - path-filtered, Chromium cached on the lockfile hash, failure artifacts uploaded for 7 days.

**The two local-only settings, both now keyed off process.env.CI.** forbidOnly is on in CI - a stray .only silently reduces the suite to one test and reports green. retries goes 0 -> 1 in CI, and the reasoning is recorded next to it because the existing comment argues the opposite: a retry does not hide flake here, since Playwright reports retried-then-passed as *flaky* rather than passed. The signal survives while a slow shared runner does not turn the workflow red. The hydration waits mean it should rarely fire; if it fires regularly that is a bug, not a number to raise.

**The axe question.** Baseline stays a hard gate. It is empty on all four page/theme combinations because someone drove it to zero deliberately, so it is an achievable bar rather than an aspirational one, and the documented escape hatch is regenerating the baseline with a note - not loosening the check.

**The definition-of-done item about proving the check checks.** Could not run the workflow (no push from this session), so verified what the workflow actually depends on. Rather than a synthetic failing test, reproduced the exact historical regression this task cites: restored the [field-sizing:content] assertion in Board.test.tsx against DetailView's field-sizing-content. pnpm test exited **1** with 1 failed / 659 passed, naming the test. Restored the file via git checkout and confirmed clean. Since ci.yml runs pnpm test as a step, a non-zero exit fails the job.

Also verified pnpm install --frozen-lockfile passes against the committed lockfile - that is CI step one and would have failed everything downstream if the manifests and lockfile had drifted during publish readiness. All four steps exit 0 on a clean tree: typecheck, lint, test (660 across 31 files), build.

**Left for the owner:** the first real workflow run happens on push. If astro check needs a content-collection sync step in a cold CI checkout, that is the most likely first failure - it passes locally because .astro/ already exists.

**Note on apps/site/e2e/README.md:** its 'this repo has no CI' paragraph was the known limit the task pointed at. Replaced with a 'When these run' section carrying the filter, its reasoning, the two CI-only settings, and the axe posture.
