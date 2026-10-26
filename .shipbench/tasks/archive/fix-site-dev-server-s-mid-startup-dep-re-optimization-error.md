---
title: Fix site dev server's mid-startup dep re-optimization error
status: done
priority: medium
tags:
  - site
  - bug
  - dx
created: '2026-09-26T19:56:19.706Z'
updated: '2026-09-26T19:59:10.726Z'
---

`pnpm dev` in `apps/site` logs an error during startup, before `ready`:

```
dependency optimized: astro/app/manifest
optimized dependencies changed. reloading
[vite] program reload
dependency optimized: @astrojs/svelte/server.js
optimized dependencies changed. reloading
[vite] An error happened during full reload
The file does not exist at ".../node_modules/.vite/deps_ssr/route-cache-BVwisgon.js?v=88f4b881"
which is in the optimize deps directory. The dependency might be incompatible with the dep
optimizer. Try adding it to `optimizeDeps.exclude`.
```

The server recovers and pages serve, so the error is noise, but it shows up on every start that begins from a cold or invalidated cache. Its advice to use `optimizeDeps.exclude` is wrong for this case.

## Cause

This is the same failure family as Harbor's `fix-harbor-dev-ssr-dual-react-invalid-hook-call-on-first-load`: Vite's cold-start pre-bundle of server deps is incomplete, so deps are discovered while the server runs.

`@astrojs/cloudflare` passes a fixed `optimizeDeps.include` list to the `astro`, `ssr`, and `prerender` environments. Three modules the dev worker loads for this site aren't on it:

- `astro/app/manifest`, which the adapter list misses.
- `@astrojs/svelte/server.js`, the Svelte renderer. It's integration-specific, so the adapter can't know about it.
- `astro/logger/json`, which loads only when `astro dev` runs in the background (`--background`, or any start without a TTY, such as an agent's). A foreground start doesn't hit it.

Vite finds each one when the worker first imports it and re-optimizes `deps_ssr`. That rewrites the shared chunks under new hashed names (`route-cache-*`, `handler-*`, and so on). The worker reload started by the previous re-optimization is still importing the old chunk names, which the new pass has deleted, so the reload fails.

**Why it shows up on a "warm" start.** `astro check` and vitest share `node_modules/.vite` with the dev server but resolve a different Vite config. Running either between dev sessions changes the stored config hash, so the next `astro dev` logs `Re-optimizing dependencies because vite config has changed` and pre-bundles from scratch. That's the double "config has changed" in the original log. It's harmless by itself, but before the fix every such start was a cold start and hit the race.

Only `deps_ssr` is affected. After a cold start, `deps_astro` holds nothing beyond the adapter's list, and there is no prerender dep cache.

## Reproduce

Use a scratch worktree, not the live checkout, so a running dev server's `.vite` cache isn't disturbed. Delete `apps/site/node_modules/.vite`, run `astro dev --background --port 4400`, request a few pages, and read `astro dev logs`. Before the fix this fails every time. The missing chunk's name varies from run to run.

## Fix

In `apps/site/astro.config.mjs`, list the three modules in `vite.ssr.optimizeDeps.include` (the `ssrLateDeps` constant). Vite merges that into the `ssr` environment alongside the adapter's list, so the cold-start pass is complete and nothing re-optimizes mid-session. Only `ssr` gets the extra entries; putting them in top-level `vite.optimizeDeps.include`, which the adapter also reads, would make the client environment try to bundle the server renderer.

**If the error returns** after an Astro, adapter, or integration upgrade, the `dependency optimized: <id>` line just above it names the module to add.

## Verify

In a scratch worktree, with the fix applied:

- Cold start (cache deleted): no `dependency optimized` lines, no reload, no error, and all pages return 200.
- Two warm starts in a row: no re-optimization at all.
- Warm start after `astro check` and `vitest run`: the expected full re-optimization, then clean.
- `astro check` and `vitest run` both pass.

## Task Updates

### 2026-09-26T19:57:38.874Z
Fixed in apps/site/astro.config.mjs (ssrLateDeps -> vite.ssr.optimizeDeps.include). Verified in a scratch worktree: the cold start that reproduced the error every time now logs no late dependency finds, no reloads, and no errors; warm starts don't re-optimize; astro check (0 errors), vitest, astro build, and biome lint all pass. Your running dev server will re-optimize once on its next start because the Vite config changed. That's expected and should now be clean.
