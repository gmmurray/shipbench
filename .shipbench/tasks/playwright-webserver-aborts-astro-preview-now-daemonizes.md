---
title: 'Playwright webServer aborts: astro preview now daemonizes'
status: todo
priority: high
tags:
  - site
  - testing
  - ci
  - infra
created: '2026-08-29T19:59:38.850Z'
updated: '2026-08-29T19:59:38.850Z'
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
