/**
 * Stops the background preview server after the suite finishes.
 *
 * `preview-server.mjs` handles SIGTERM/SIGINT, which is enough on POSIX — and
 * therefore in CI. It is not enough on Windows, where Playwright terminates the
 * webServer process rather than signalling it, so the handlers never run and
 * `astro preview`'s daemon is left listening. A leaked server then serves its
 * startup-time asset manifest on the next run, which makes `/pagefind/*` 404 and
 * the search specs fail as though the index had regressed.
 *
 * Playwright always runs globalTeardown after a completed suite, on every
 * platform, so cleanup lives here and the signal handlers are the belt to its
 * braces rather than the only route.
 */

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export default function globalTeardown(): void {
  // One command string rather than an args array: `shell: true` is needed on
  // Windows for pnpm's .CMD shim, and the array form under shell emits DEP0190.
  spawnSync('pnpm exec astro preview stop', {
    cwd: siteDir,
    shell: true,
    stdio: 'ignore',
  });
}
