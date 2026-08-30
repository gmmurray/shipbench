---
title: 'Playwright webServer aborts: astro preview now daemonizes'
status: done
priority: high
tags:
  - site
  - testing
  - ci
  - infra
created: '2026-08-29T19:59:38.850Z'
updated: '2026-08-30T19:56:39.983Z'
---

`pnpm --filter @shipbench/site test:e2e` fails before running a single test:

```
Error: Process from config.webServer exited early.
```

**This is not the stale-server hazard documented in `e2e/README.md`.** It reproduces from a completely clean port.

## Cause

`astro preview` backgrounds itself in Astro 7.2.4. Measured from a verified-empty port 4321:

```
returned after 4s, rc=0
{"message":"Preview server running at http://localhost:4321 (pid 33500)  Stop: astro preview stop ..."}
```

Playwright's `webServer` expects its `command` to stay in the foreground for the life of the run. Astro's returns immediately and leaves a daemon behind, so Playwright concludes the server died and aborts.

The CLI now carries `stop`, `status`, and `logs [--follow]` subcommands and a `--background` flag. `--background` is documented as opt-in, but the observed default already daemonizes — so the flag is not the lever, and there is no `--foreground`.

Every failed run also leaks a listening server, which then looks like the stale-server problem the README describes and sends the reader down the wrong path. Worth a note there once this is fixed.

## Why this has not been noticed

The e2e workflow is path-filtered to `apps/site/**` and `pnpm-lock.yaml`, and **no change touching either has been pushed since CI was added**. The workflow has never run. The first site change to land will fail on it — including `cleanup-typecheck-warnings`, which touches two files under `apps/site/src/scripts/`.

So the harness has been broken for some time and is only now becoming visible.

## The harness itself is fine

Verified 2026-08-29 by starting the preview server manually against a fresh production build and running `pnpm exec playwright test` directly, which reuses it via `reuseExistingServer`:

```
97 passed, 1 skipped (9.5s)
```

Search, focus trap, theme first-paint, axe, and built-output all pass. **Only the server-startup integration is broken**, not any test.

## Shape of a fix

Playwright needs a process that blocks. Options, roughly in order of preference:

1. **A small launcher script** as `webServer.command` — starts the preview, blocks, and stops it on `SIGTERM`/`SIGINT` so nothing leaks. Most robust, and it can fail loudly if the port is already occupied rather than silently reusing a stale build.
2. **`astro preview` then `astro preview logs --follow`** chained, so the second command blocks. Less code, but Playwright's teardown kills the log follower rather than the server, so it leaks a daemon on every run — the exact hazard already documented.
3. **Serve `dist/client` with a plain static server.** Simplest and fully foreground, but it stops exercising the wrangler-backed preview that `@astrojs/cloudflare` provides, which is deliberately what deploys. This trades away part of the harness's point.

Whichever is chosen, `reuseExistingServer` deserves revisiting. It is what makes a stale server look like an index regression, and in CI it should almost certainly be false.

## Definition of done

- `pnpm --filter @shipbench/site test:e2e` runs the suite from a clean port with no manual setup.
- No listening server survives a completed or failed run.
- A real CI run of `e2e.yml` is green — this is the first time that workflow will have executed, so it needs watching rather than assuming.
- `e2e/README.md` updated so the stale-server section does not misdirect.

## Task Updates

### 2026-08-29T20:13:41.173Z
Done 2026-08-29. pnpm --filter @shipbench/site test:e2e runs the full suite from a clean port and leaves nothing behind.

**Fix: option 1 from the task - a foreground wrapper.** e2e/support/preview-server.mjs starts the preview, polls until it answers, holds the foreground so Playwright sees a live process, and stops the daemon on SIGTERM/SIGINT. playwright.config.ts points webServer.command at it.

**Signals alone were not enough, and the first attempt proved it.** With only the wrapper's handlers, a completed run still left pid 20276 listening. On Windows Playwright terminates the webServer process rather than signalling it, so the handlers never fire. Added e2e/support/global-teardown.ts, which Playwright always runs after a suite on every platform. The signal handlers stay as the POSIX and interrupt path - that is genuine belt-and-braces, unlike the NPM_CONFIG_PROVENANCE case where one of the two routes silently did nothing, and both were verified here rather than assumed.

**reuseExistingServer flipped to false.** It was what made a stale server look like a Pagefind index regression: a leftover process keeps serving its startup-time asset manifest, so HTML resolves off disk while /pagefind/* 404s and the search specs fail with 'Search index unavailable'. The wrapper now refuses to start on a busy port and prints the stop command. Verified by occupying 4321 with a decoy server: exits 1 with the remedy rather than adopting it.

**Two bugs introduced and caught during the work, both worth recording because they are the same class this repo keeps hitting.**

1. My spawnSync calls used an args array with shell: true, which emits DEP0190 on every run - adding deprecation noise in the same session as a task about removing it. Changed to a single command string; shell is still required for pnpm's .CMD shim on Windows. Verified 0 DEP0190 in the run output.
2. An unused spawn import put astro check back to 1 hint immediately after cleanup-typecheck-warnings had driven it to 0. The two new support files are inside the checked set - 38 files became 40 - so anything added here is now subject to that bar. Removed; back to 0 hints across 40 files.

**Verified.** test:e2e from a verified-clean port: exit 0, 97 passed, 1 skipped, 0 DEP0190, port clear afterwards. Port-conflict path exits 1 with a useful message. Full typecheck, lint, 660 tests, build all exit 0. astro check 0 errors, 0 warnings, 0 hints.

**e2e/README.md rewritten where it misdirected.** The old 'a second run can reuse a stale server' section described Playwright adopting a leftover process, which is no longer what happens and would send the next reader chasing the wrong thing - that section cost two runs during diagnosis. Replaced with how the preview server is actually started, why the wrapper exists, why reuseExistingServer is false, and what the port-conflict message means. Support file listing updated.

**Still unverified from here: CI.** This will be the first execution of e2e.yml - the path filter is apps/site/**, and nothing touching it has been pushed since CI was added. Ubuntu should be the easier case, since signals work there and the wrapper's handlers apply, but it has never run. Watch that first run rather than assuming.
