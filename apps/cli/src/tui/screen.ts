/**
 * The output driver: escape sequences and a previous-frame cache, no render tree.
 *
 * Three properties matter more than anything a framework offers here:
 *
 * 1. **stdin is never touched.** No raw mode, so Ctrl-C still produces SIGINT
 *    through the ordinary Node path and there is no key parser to get wrong. A
 *    zero-input visualizer that puts the terminal in raw mode has taken on the
 *    hardest part of an interactive TUI for no benefit.
 * 2. **Restoration is synchronous and idempotent.** `process.on('exit')` is the
 *    last handler to run on every exit path, including an uncaught exception, and
 *    `writeSync` cannot be interrupted by the event loop dying.
 * 3. **Only changed rows are written.** An idle board costs zero bytes; a single
 *    task move costs one line.
 *
 * The alternate screen is not optional. The whole point of a dedicated pane is
 * that the board occupies it: repainting inline scrolls the board into shell
 * history, and absolute cursor addressing would clobber whatever sits above the
 * process's own output.
 */

import { writeSync } from 'node:fs';
import { cursorTo, ESC } from './style.js';

export interface ScreenOptions {
  out?: NodeJS.WriteStream;
}

export interface Screen {
  readonly width: number;
  readonly height: number;
  paint(lines: string[]): void;
  onResize(handler: () => void): void;
  close(): void;
}

const FALLBACK_WIDTH = 80;
const FALLBACK_HEIGHT = 24;

export function createScreen(options: ScreenOptions = {}): Screen {
  const out = options.out ?? process.stdout;
  const fd = (out as unknown as { fd?: number }).fd ?? 1;
  let closed = false;
  let previous: string[] = [];

  out.write(ESC.altScreenEnter + ESC.eraseScreen + ESC.hideCursor + ESC.noWrap);

  const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'] as const;
  const resizeListeners: Array<() => void> = [];

  function restore(): void {
    if (closed) return;
    closed = true;
    detach();
    try {
      writeSync(fd, ESC.reset + ESC.wrap + ESC.showCursor + ESC.altScreenExit);
    } catch {
      // A closed parent terminal makes this throw EPIPE/EBADF. Nothing is left to
      // restore in that case, and throwing from an exit handler would be worse.
    }
  }

  /**
   * Hand back every listener this screen installed.
   *
   * `board terminal` opens one screen and holds it for the life of the process,
   * so leaving them attached would cost nothing there. Anything that opens and
   * closes screens in a loop — a test file, most obviously — otherwise adds five
   * process listeners per screen and trips Node's max-listeners warning within a
   * handful. Removing listeners while `exit` is being emitted is safe; Node
   * copies the handler list before iterating it.
   */
  function detach(): void {
    process.off('exit', restore);
    for (const signal of SIGNALS) process.off(signal, onSignal);
    for (const listener of resizeListeners) out.off('resize', listener);
    resizeListeners.length = 0;
  }

  function onSignal(): void {
    restore();
    process.exit(0);
  }

  process.on('exit', restore);
  for (const signal of SIGNALS) process.on(signal, onSignal);

  return {
    get width() {
      return out.columns ?? FALLBACK_WIDTH;
    },
    get height() {
      return out.rows ?? FALLBACK_HEIGHT;
    },
    paint(lines) {
      if (closed) return;
      const frame = lines.slice(0, this.height);
      const rows = Math.max(frame.length, previous.length);
      let buffer = '';
      for (let row = 0; row < rows; row += 1) {
        const line = frame[row] ?? '';
        if (previous[row] === line) continue;
        buffer += cursorTo(row + 1) + ESC.eraseLine + line;
      }
      previous = frame;
      if (buffer === '') return;
      out.write(ESC.syncStart + buffer + ESC.syncEnd);
    },
    onResize(handler) {
      const listener = () => {
        // Every cached row is invalid at a new width; force a full repaint.
        previous = [];
        out.write(ESC.home + ESC.eraseBelow);
        handler();
      };
      resizeListeners.push(listener);
      out.on('resize', listener);
    },
    close: restore,
  };
}
