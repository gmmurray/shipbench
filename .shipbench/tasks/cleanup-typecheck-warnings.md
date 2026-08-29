---
title: cleanup typecheck warnings
status: done
priority: low
created: '2026-08-29T19:19:22.895Z'
updated: '2026-08-29T20:06:07.246Z'
---

from a CI/CD run:
```
Run pnpm typecheck
$ tsc -p tests/tsconfig.json --noEmit && tsc -p scripts/tsconfig.json --noEmit && pnpm -r run typecheck
Scope: 4 of 5 workspace projects
apps/site typecheck$ astro check && svelte-check --tsconfig ./tsconfig.json --output human
packages/core typecheck$ tsc --noEmit
packages/core typecheck: Done
apps/site typecheck: 19:18:25 [@astrojs/cloudflare] Enabling image processing with Cloudflare Images for production with the "IMAGES" Images binding.
apps/site typecheck: 19:18:25 [@astrojs/cloudflare] Enabling sessions with Cloudflare KV with the "SESSION" KV binding.
apps/site typecheck: 19:18:26 [content] Syncing content
apps/site typecheck: 19:18:26 [content] Synced content
apps/site typecheck: 19:18:26 [types] Generated 1.00s
apps/site typecheck: 19:18:26 [check] Getting diagnostics for Astro files in /home/runner/work/shipbench/shipbench/apps/site...
apps/site typecheck: src/content.config.ts:11:14 - warning ts(6385): 'z' is deprecated.
apps/site typecheck: 11     updated: z.coerce.date().optional(),
apps/site typecheck:                 ~
apps/site typecheck: src/content.config.ts:10:12 - warning ts(6385): 'z' is deprecated.
apps/site typecheck: 10     order: z.number().default(0),
apps/site typecheck:               ~
apps/site typecheck: src/content.config.ts:9:12 - warning ts(6385): 'z' is deprecated.
apps/site typecheck: 9     group: z.string(),
apps/site typecheck:              ~
apps/site typecheck: src/content.config.ts:8:18 - warning ts(6385): 'z' is deprecated.
apps/site typecheck: 8     description: z.string().optional(),
apps/site typecheck:                    ~
apps/site typecheck: src/content.config.ts:7:12 - warning ts(6385): 'z' is deprecated.
apps/site typecheck: 7     title: z.string(),
apps/site typecheck:              ~
apps/site typecheck: src/content.config.ts:6:11 - warning ts(6385): 'z' is deprecated.
apps/site typecheck: 6   schema: z.object({
apps/site typecheck:             ~
apps/site typecheck: src/content.config.ts:1:28 - warning ts(6385): 'z' is deprecated.
apps/site typecheck: 1 import { defineCollection, z } from 'astro:content';
apps/site typecheck:                              ~
apps/site typecheck: src/scripts/code-copy.ts:88:21 - warning ts(6387): The signature '(commandId: string, showUI?: boolean | undefined, value?: string | undefined): boolean' of 'document.execCommand' is deprecated.
apps/site typecheck: 88     return document.execCommand('copy');
apps/site typecheck:                        ~~~~~~~~~~~
apps/site typecheck: src/scripts/search-triggers.ts:21:15 - warning ts(6385): 'platform' is deprecated.
apps/site typecheck: 21     navigator.platform ||
apps/site typecheck:                  ~~~~~~~~
apps/site typecheck: Result (38 files): 
apps/site typecheck: - 0 errors
apps/site typecheck: - 0 warnings
apps/site typecheck: - 9 hints
apps/site typecheck: svelte-check found 0 errors and 0 warnings
apps/site typecheck: 
apps/site typecheck: Done
```

## Task Updates

### 2026-08-29T20:00:22.397Z
Done 2026-08-29. astro check goes from 9 hints to 0. Note these were hints, never errors - 'Result (38 files): 0 errors, 0 warnings, 9 hints' - which is why pnpm typecheck already exited 0. Noise reduction, correctly filed as low priority.

**Only one of the three was an actual oversight; the other two are deliberate fallbacks.**

**1. The z import (7 of the 9 hints) - a real deprecation, and the obvious fix would have been wrong.** src/content.config.ts imported z from astro:content, which is deprecated. The natural migration is astro:schema, but that is deprecated too - astro/client.d.ts in 7.2.4 says 'import { z } from astro:schema is deprecated and will be removed in Astro 7. Use import { z } from astro/zod instead.' So the obvious fix swaps one deprecated import for another. Now imports from astro/zod, verified to resolve and expose object, string, number, and coerce before changing anything.

**2. document.execCommand in code-copy.ts - kept.** The enclosing function is named legacyCopy. It is the fallback for contexts without navigator.clipboard, notably any non-secure origin, and is only reached when the modern path is unavailable. Removing it would silently break copy rather than modernise anything.

**3. navigator.platform in search-triggers.ts - kept.** isMac() already tries userAgentData.platform first and falls back. userAgentData is Chromium-only; Safari and Firefox have neither shipped it nor committed to it, and Safari is where 'is this a Mac' matters most. Dropping the fallback would show Ctrl to Mac Safari users.

For 2 and 3 the hint is silenced by a cast to a shape without the deprecated signature, with a comment recording why the deprecated call is correct. TypeScript has no per-line suppression for deprecation suggestions, and raising astro check's severity floor would hide future real deprecations. One detail worth keeping: intersecting with Document leaves the deprecated overload in the resolution set and the hint survives - the first attempt did exactly that and had to be changed to replace the type rather than intersect with it.

**Verified.** astro check: 0 errors, 0 warnings, 0 hints. Full typecheck, lint, 660 tests, and build all exit 0. Site production build: 13 pages plus Pagefind index, which exercises the changed schema import since content collections validate at build time.

**Browser verification, because two of these are runtime paths.** Ran the Playwright harness: 97 passed, 1 skipped, including every search spec - which is what exercises isMac(). Type-level casts should be behaviour-preserving, but I had already got one cast wrong, so asserting it would have been the weaker claim.

**Blocking finding, filed separately as playwright-webserver-aborts-astro-preview-now-daemonizes.** The e2e harness cannot start its own server: astro preview daemonizes in Astro 7.2.4, so Playwright's webServer sees the process exit and aborts. Reproduced from a verified-empty port, so it is not the stale-server hazard the README documents. It predates this task, but it matters here because the e2e workflow is path-filtered to apps/site/** and has never run in CI - and this change touches apps/site/src/scripts/, so it is the change that will trigger it. Expect e2e.yml to fail on the push carrying this work, for a reason unrelated to it.
