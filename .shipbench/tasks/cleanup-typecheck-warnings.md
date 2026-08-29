---
title: cleanup typecheck warnings
status: backlog
priority: low
created: '2026-08-29T19:19:22.895Z'
updated: '2026-08-29T19:19:38.287Z'
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
