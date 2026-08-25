/**
 * The output driver's byte-level contract, with no PTY.
 *
 * The diffed repaint is the regression that matters here: it degrades to a
 * full-frame rewrite silently — the board still looks right, it just costs 24
 * rows a second instead of one — and nothing outside these tests would notice.
 *
 * What the escape sequences *do* still needs a real console and stays on the
 * opt-in probe harnesses. What they *are* is asserted here.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createScreen, type Screen } from './screen.js';
import { ESC } from './style.js';
import {
  createTestTerminal,
  rowsTouched,
  type TestTerminal,
  type TestTerminalOptions,
} from './testing.js';

const ENTRY =
  ESC.altScreenEnter + ESC.eraseScreen + ESC.hideCursor + ESC.noWrap;
const RESTORE = ESC.reset + ESC.wrap + ESC.showCursor + ESC.altScreenExit;

const terminals: TestTerminal[] = [];
const screens: Screen[] = [];

function open(options: TestTerminalOptions = {}): {
  tty: TestTerminal;
  screen: Screen;
} {
  const tty = createTestTerminal(options);
  terminals.push(tty);
  const screen = createScreen({ out: tty.stream });
  screens.push(screen);
  return { tty, screen };
}

/**
 * The chunks written from here on. `frame()` replays every write a terminal has
 * ever received, so tests take a mark rather than emptying the log — truncating
 * it would leave the replayed frame missing the rows an earlier paint drew.
 */
function mark(tty: TestTerminal): () => string[] {
  const at = tty.writes.length;
  return () => tty.writes.slice(at);
}

afterEach(() => {
  for (const screen of screens.splice(0)) screen.close();
  for (const tty of terminals.splice(0)) tty.dispose();
});

describe('the alternate screen', () => {
  it('enters on construction and leaves on close', () => {
    const { tty, screen } = open();

    expect(tty.writes[0]).toBe(ENTRY);
    expect(tty.restored()).toBe('');

    screen.close();
    expect(tty.restored()).toBe(RESTORE);
  });

  it('restores exactly once however many times it is closed', () => {
    // `close()` and the `exit` handler are the same function, and on an ordinary
    // quit both run. A second restore would re-enter nothing, but it would write
    // an alt-screen exit into the shell the first one just handed back.
    const { tty, screen } = open();
    screen.close();
    screen.close();
    screen.close();

    expect(tty.restored()).toBe(RESTORE);
  });

  it('paints nothing after close', () => {
    const { tty, screen } = open();
    screen.close();
    const since = mark(tty);

    screen.paint(['anything']);
    expect(since()).toEqual([]);
  });

  it('hands back every listener it installed', () => {
    // The blocker this task had to clear first: five process listeners per
    // screen, never removed, trips Node's max-listeners warning within a handful
    // of cases. Five screens is already half of Node's default limit of ten.
    const counts = () => ({
      exit: process.listenerCount('exit'),
      SIGINT: process.listenerCount('SIGINT'),
      SIGTERM: process.listenerCount('SIGTERM'),
      SIGHUP: process.listenerCount('SIGHUP'),
      SIGBREAK: process.listenerCount('SIGBREAK'),
    });
    const before = counts();

    const opened = Array.from({ length: 5 }, () => open());
    for (const { screen } of opened) screen.onResize(() => undefined);

    expect(counts()).toEqual({
      exit: before.exit + 5,
      SIGINT: before.SIGINT + 5,
      SIGTERM: before.SIGTERM + 5,
      SIGHUP: before.SIGHUP + 5,
      SIGBREAK: before.SIGBREAK + 5,
    });
    for (const { tty } of opened) {
      expect(tty.stream.listenerCount('resize')).toBe(1);
    }

    for (const { screen } of opened) screen.close();

    expect(counts()).toEqual(before);
    for (const { tty } of opened) {
      expect(tty.stream.listenerCount('resize')).toBe(0);
    }
  });
});

describe('the diffed repaint', () => {
  it('wraps a repaint in one synchronised update', () => {
    const { tty, screen } = open({ columns: 40, rows: 6 });
    const since = mark(tty);

    screen.paint(['alpha', 'beta', 'gamma']);

    expect(since()).toHaveLength(1);
    expect(since()[0].startsWith(ESC.syncStart)).toBe(true);
    expect(since()[0].endsWith(ESC.syncEnd)).toBe(true);
    expect(tty.frame()).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('touches only the rows that changed', () => {
    const { tty, screen } = open({ columns: 40, rows: 24 });
    const rows = Array.from({ length: 20 }, (_, i) => `row ${i}`);
    screen.paint(rows);
    const since = mark(tty);

    screen.paint(rows.map((row, i) => (i === 7 ? 'changed' : row)));

    expect(rowsTouched(since().join(''))).toEqual([8]);
    expect(tty.frame()[7]).toBe('changed');
  });

  it('writes nothing at all when the frame is identical', () => {
    // An idle board is the common case, and it has to cost zero bytes — a pane
    // left open overnight otherwise writes a full frame per watcher event.
    const { tty, screen } = open({ columns: 40, rows: 6 });
    screen.paint(['alpha', 'beta']);
    const since = mark(tty);

    screen.paint(['alpha', 'beta']);

    expect(since()).toEqual([]);
  });

  it('erases the rows a shorter frame left behind', () => {
    // Without this the last two tasks of a column stay on screen after they are
    // archived, and the board is quietly lying.
    const { tty, screen } = open({ columns: 40, rows: 10 });
    screen.paint(['a', 'b', 'c', 'd', 'e']);
    const since = mark(tty);

    screen.paint(['a', 'b', 'c']);

    expect(rowsTouched(since().join(''))).toEqual([4, 5]);
    expect(tty.frame()).toEqual(['a', 'b', 'c', '', '']);
  });

  it('never paints past the bottom of the viewport', () => {
    const { tty, screen } = open({ columns: 40, rows: 3 });
    const since = mark(tty);

    screen.paint(['1', '2', '3', '4', '5', '6']);

    expect(rowsTouched(since().join(''))).toEqual([1, 2, 3]);
  });
});

describe('viewport', () => {
  it('reads the size off the stream, and re-reads it after a resize', () => {
    const { tty, screen } = open({ columns: 120, rows: 40 });
    expect([screen.width, screen.height]).toEqual([120, 40]);

    tty.resize(80, 24);
    expect([screen.width, screen.height]).toEqual([80, 24]);
  });

  it('falls back to 80x24 when the stream reports no size', () => {
    const { tty, screen } = open();
    const stream = tty.stream as unknown as {
      columns?: number;
      rows?: number;
    };
    stream.columns = undefined;
    stream.rows = undefined;

    expect([screen.width, screen.height]).toEqual([80, 24]);
  });

  it('invalidates every cached row on resize', () => {
    // Cached rows are cached at the old width. Keeping them means a narrowed
    // terminal shows a frame half of whose rows are still the wide layout.
    const { tty, screen } = open({ columns: 40, rows: 6 });
    let resized = 0;
    screen.onResize(() => {
      resized += 1;
    });
    screen.paint(['alpha', 'beta', 'gamma']);
    const since = mark(tty);

    tty.resize(30, 6);

    expect(resized).toBe(1);
    expect(since()).toEqual([ESC.home + ESC.eraseBelow]);

    // Same content, and every row is still written: the cache is gone.
    screen.paint(['alpha', 'beta', 'gamma']);
    expect(rowsTouched(since().slice(1).join(''))).toEqual([1, 2, 3]);
  });
});
