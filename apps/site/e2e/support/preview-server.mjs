/**
 * Foreground wrapper around `astro preview` for Playwright's `webServer`.
 *
 * Astro's preview command daemonizes: it starts a background server, prints its
 * pid, and exits 0 within a few seconds. Playwright expects `webServer.command`
 * to stay in the foreground for the life of the run, so pointing it straight at
 * `astro preview` makes it conclude the server died — "Process from
 * config.webServer exited early" — before a single test runs. Astro exposes a
 * `--background` flag but no `--foreground`; backgrounding is already the
 * default behaviour.
 *
 * This script restores the contract Playwright expects:
 *
 *   1. Refuse to start if the port is taken, rather than silently adopting
 *      whatever is already there. A leftover server keeps serving its
 *      startup-time asset manifest, so `/pagefind/*` 404s and the search specs
 *      fail as though the index had regressed. That misdiagnosis is expensive.
 *   2. Start the preview and wait for it to actually answer.
 *   3. Block, so Playwright sees a live process.
 *   4. Stop the preview on SIGTERM/SIGINT so nothing is left listening.
 *
 * Run directly for a foreground preview outside Playwright:
 *   node e2e/support/preview-server.mjs [port]
 */

import { spawnSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const port = Number(process.argv[2] ?? process.env.SITE_E2E_PORT ?? 4321);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error(`Invalid port: ${process.argv[2] ?? process.env.SITE_E2E_PORT}`);
  process.exit(1);
}
const url = `http://localhost:${port}/`;

const READY_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 250;

/** Resolves true if something accepts a TCP connection on the port. */
function portInUse() {
  return new Promise(resolvePort => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const done = result => {
      socket.destroy();
      resolvePort(result);
    };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(1000, () => done(false));
  });
}

/**
 * `shell: true` is required on Windows, where `pnpm` is a `.CMD` shim. The
 * command is passed as one string rather than as an args array because the
 * array form under `shell: true` emits DEP0190 — args are concatenated, not
 * escaped. Everything interpolated here is a literal or the validated integer
 * port, so concatenation is safe.
 */
function astro(argString, options = {}) {
  return spawnSync(`pnpm exec astro ${argString}`, {
    cwd: siteDir,
    shell: true,
    encoding: 'utf8',
    ...options,
  });
}

function stopPreview() {
  astro('preview stop', { stdio: 'ignore' });
}

async function waitForReady() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      // Any HTTP answer means the server is up; the status is the suite's problem.
      if (response.status > 0) return;
    } catch {
      // Not listening yet.
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Preview server did not answer at ${url} within ${READY_TIMEOUT_MS}ms`);
}

if (await portInUse()) {
  console.error(
    `Port ${port} is already in use.\n\n` +
      'A previous run may have left a preview server behind. It would serve a\n' +
      'stale build, so search specs would fail as if the Pagefind index had\n' +
      'regressed. Stop it and re-run:\n\n' +
      '  pnpm --filter @shipbench/site exec astro preview stop\n',
  );
  process.exit(1);
}

const start = astro(`preview --port ${port}`, { stdio: 'inherit' });
if (start.status !== 0) {
  console.error(`\`astro preview\` exited ${start.status}`);
  process.exit(start.status ?? 1);
}

try {
  await waitForReady();
} catch (error) {
  stopPreview();
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
}

console.log(`Preview server ready at ${url} (held in the foreground)`);

let stopping = false;
const shutdown = signal => {
  if (stopping) return;
  stopping = true;
  stopPreview();
  // Exit with the conventional signal code so Playwright sees a normal teardown.
  process.exit(signal === 'SIGINT' ? 130 : 143);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
// Windows: Playwright terminates the process rather than signalling it, so also
// clean up if the parent goes away and stdin closes under us.
process.stdin.on('close', () => shutdown('SIGTERM'));
process.stdin.resume();

// Hold the event loop open indefinitely; the signal handlers own the exit.
await new Promise(() => {});
