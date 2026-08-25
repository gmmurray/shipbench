/**
 * Wire-up: read → render → paint, repeated on watcher events and on resize.
 *
 * Resilience posture, stated once because every branch below follows it: the
 * first read is allowed to be fatal (there is nothing to show), and every read
 * after it is not. A failed refresh keeps the last good frame on screen and puts
 * a warning on the status line. An agent writing a burst of task files must never
 * be able to kill this process.
 */

import type { ReadableStorageAdapter, ShipbenchConfig } from '@shipbench/core';
import { shouldUseColor } from '../terminal.js';
import type { BoardModel, TuiFilters } from './model.js';
import { readBoard } from './read.js';
import { renderBoard } from './render.js';
import { createScreen, type Screen } from './screen.js';
import { createStyler } from './style.js';
import { type WatchProject, watchProject } from './watch.js';

/** The conventional terminal the non-TTY frame is rendered against. */
const PIPED_VIEWPORT = { width: 80, height: 24 } as const;

export interface RunTuiOptions {
  adapter: ReadableStorageAdapter;
  cwd: string;
  filters: TuiFilters;
  out?: NodeJS.WriteStream;
  env?: NodeJS.ProcessEnv;
  /**
   * Ends the run: closes the watcher, releases the keepalive, and hands the
   * terminal back. `board terminal` passes none, because the process runs until
   * a signal kills it and the handlers `createScreen` installed do the restoring
   * on the way out. Anything that has to *stop* a run and keep going — a test,
   * an embedder — needs a path that unwinds, and this is it.
   */
  signal?: AbortSignal;
  /**
   * The project watcher factory, defaulting to the chokidar-backed
   * `watchProject`. A stand-in lets a caller drive `refresh` directly instead of
   * through a 150 ms debounce and a real filesystem event.
   */
  watch?: WatchProject;
}

export async function runTui(options: RunTuiOptions): Promise<void> {
  const out = options.out ?? process.stdout;
  const env = options.env ?? process.env;
  const watch = options.watch ?? watchProject;
  const signal = options.signal;

  const first = await readBoard(options.adapter, options.filters);
  if (!first.ok) throw new Error(first.message);

  const isTty = out.isTTY === true;
  const style = createStyler({ color: shouldUseColor(env, isTty) });

  // No TTY means no viewport to budget against, no resize events, and nobody to
  // watch the repaint. Emit one plain frame at a conventional 80x24 and exit —
  // which is also what makes `board terminal > snapshot.txt` and piping into a
  // log useful rather than a file full of cursor-positioning escapes.
  if (!isTty) {
    const lines = renderBoard(first.model, PIPED_VIEWPORT, {
      style,
      config: first.config,
    });
    out.write(`${lines.join('\n')}\n`);
    return;
  }

  const screen: Screen = createScreen({ out });

  let model: BoardModel = first.model;
  let config: ShipbenchConfig = first.config;

  function paint(): void {
    screen.paint(
      renderBoard(
        model,
        { width: screen.width, height: screen.height },
        { style, config },
      ),
    );
  }

  async function refresh(): Promise<void> {
    const outcome = await readBoard(options.adapter, options.filters);
    if (outcome.ok) {
      model = outcome.model;
      config = outcome.config;
    } else {
      // Keep the frame, flag the failure. A config broken between the watch
      // event and the read, or a storage error, lands here. A task file caught
      // mid-write does not: `readBoard` returns that as a successful partial
      // read with a warning, handled in the branch above.
      model = {
        ...model,
        notice: outcome.message,
        staleSince: model.staleSince ?? new Date(),
      };
    }
    paint();
  }

  screen.onResize(paint);
  paint();

  const watcher = await watch(options.cwd, () => refresh());

  // A pending promise is not a libuv handle, and neither is a `resize` listener
  // on stdout. Without something referenced holding the loop, the process paints
  // one frame and exits — which is exactly what the first Windows Terminal probe
  // run caught. chokidar's watcher happens to hold it; this does not depend on
  // that.
  const keepalive = setInterval(() => undefined, 1 << 30);

  // Without a `signal`, nothing ever resolves this. Teardown is then the signal
  // and `exit` handlers `createScreen` installed: restoring the terminal has to
  // happen synchronously on paths (an uncaught exception, SIGHUP from a closed
  // parent) that never unwind back to here.
  await new Promise<void>(resolve => {
    if (!signal) return;
    if (signal.aborted) resolve();
    else signal.addEventListener('abort', () => resolve(), { once: true });
  });

  clearInterval(keepalive);
  await watcher.close();
  screen.close();
}
