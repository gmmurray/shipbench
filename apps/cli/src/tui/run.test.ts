/**
 * The wire-up's two jobs: the piped frame, and the resilience posture.
 *
 * "The first read is allowed to be fatal and every read after it is not" is a
 * sentence in `run.ts`'s header, and it is the thing an agent writing a burst of
 * task files depends on. Both halves are cases here.
 *
 * The watcher is a stand-in, so a refresh is a function call rather than a
 * filesystem event behind a 150 ms debounce. That is not only faster: a test
 * that sleeps past a debounce and hopes is the exact shape that becomes an
 * intermittent CI failure.
 */

import { afterEach, describe, expect, it } from 'vitest';
import type { TuiFilters } from './model.js';
import { MISSING_CONFIG_MESSAGE } from './read.js';
import { runTui } from './run.js';
import {
  createMemoryProject,
  createTestTerminal,
  type MemoryProject,
  rowsTouched,
  TEST_CONFIG,
  type TestTerminal,
  type TestTerminalOptions,
  taskFile,
} from './testing.js';
import { displayWidth } from './text.js';
import type { ProjectChangeHandler } from './watch.js';

const CONFIG = '.shipbench/config.json';
const BROKEN_TASK = '---\ntitle: [unclosed\n---\n\nbody\n';

/** Three todo tasks with distinct `created` values, so their order is fixed. */
function board(): MemoryProject {
  return createMemoryProject({
    [CONFIG]: JSON.stringify(TEST_CONFIG),
    '.shipbench/tasks/first.md': taskFile('First task', {
      created: '2026-06-03T00:00:00.000Z',
    }),
    '.shipbench/tasks/second.md': taskFile('Second task', {
      created: '2026-06-02T00:00:00.000Z',
    }),
    '.shipbench/tasks/third.md': taskFile('Third task', {
      created: '2026-06-01T00:00:00.000Z',
    }),
  });
}

const terminals: TestTerminal[] = [];
const running: Array<{ controller: AbortController; done: Promise<void> }> = [];

function terminal(options: TestTerminalOptions = {}): TestTerminal {
  const tty = createTestTerminal(options);
  terminals.push(tty);
  return tty;
}

interface Run {
  tty: TestTerminal;
  /** The rows the terminal is showing. */
  frame(): string[];
  /** Fire a watcher change and wait for the refresh it drives. */
  change(): Promise<void>;
  watcherClosed(): boolean;
  stop(): Promise<void>;
}

async function start(
  project: MemoryProject,
  options: TestTerminalOptions & { filters?: TuiFilters } = {},
): Promise<Run> {
  const tty = terminal(options);
  const controller = new AbortController();
  let closed = false;
  let armed!: (handler: ProjectChangeHandler) => void;
  const ready = new Promise<ProjectChangeHandler>(resolve => {
    armed = resolve;
  });

  const done = runTui({
    adapter: project.adapter,
    cwd: '/memory',
    filters: options.filters ?? {},
    out: tty.stream,
    // Keeps the recorded frame plain text, so an assertion about it is an
    // assertion about what the operator reads.
    env: { NO_COLOR: '1' },
    signal: controller.signal,
    watch: async (_cwd, onChange) => {
      armed(onChange);
      return {
        async close() {
          closed = true;
        },
      };
    },
  });
  running.push({ controller, done });

  // Arming the watcher is the last thing `runTui` does before it parks, and the
  // first paint is already behind it — so this resolving means there is a frame.
  const fire = await ready;

  return {
    tty,
    frame: () => tty.frame(),
    change: async () => {
      await fire();
    },
    watcherClosed: () => closed,
    async stop() {
      controller.abort();
      await done;
    },
  };
}

afterEach(async () => {
  for (const { controller, done } of running.splice(0)) {
    controller.abort();
    await done;
  }
  for (const tty of terminals.splice(0)) tty.dispose();
});

describe('piped output', () => {
  it('emits one plain 80x24 frame and returns', async () => {
    // The real terminal is 200x60 and none of it matters: with no TTY there is
    // no viewport to budget against and nobody to watch a repaint. Awaiting this
    // to completion is half the assertion — the TTY path never returns.
    const tty = terminal({ isTTY: false, columns: 200, rows: 60 });

    await runTui({
      adapter: board().adapter,
      cwd: '/memory',
      filters: {},
      out: tty.stream,
      env: {},
    });

    expect(tty.writes).toHaveLength(1);
    const lines = tty.writes[0].split('\n');
    expect(lines.at(-1)).toBe('');
    expect(lines.slice(0, -1)).toHaveLength(24);
    for (const line of lines) {
      expect(displayWidth(line)).toBeLessThanOrEqual(80);
    }
    expect(tty.writes[0]).toContain('First task');
  });

  it('emits no escape sequences at all', async () => {
    // `board terminal > snapshot.txt` is the point: no alternate screen, no
    // cursor addressing, no colour. A non-TTY stdout drops styling on its own,
    // and `createScreen` — which is what writes the rest — is never reached.
    const tty = terminal({ isTTY: false });

    await runTui({
      adapter: board().adapter,
      cwd: '/memory',
      filters: {},
      out: tty.stream,
      env: {},
    });

    expect(tty.writes[0]).not.toContain('\x1b');
    expect(tty.restored()).toBe('');
  });
});

describe('the first read', () => {
  it('is fatal, and paints nothing', async () => {
    // Nothing to show and no frame to keep. The message is core's, verbatim, so
    // running `board terminal` outside a project reads like every other command.
    const tty = terminal({ isTTY: false });

    await expect(
      runTui({
        adapter: createMemoryProject().adapter,
        cwd: '/memory',
        filters: {},
        out: tty.stream,
        env: {},
      }),
    ).rejects.toThrow(MISSING_CONFIG_MESSAGE);

    expect(tty.writes).toEqual([]);
  });
});

describe('every read after the first', () => {
  it('keeps the last good frame and flags a config read failure', async () => {
    // The board rows must not move when a read cannot produce a usable config,
    // and the operator must be told why they stopped.
    //
    // Wide enough for both alerts: the status line drops whole parts rather than
    // cutting one in half.
    const project = board();
    const run = await start(project, { columns: 140 });
    const before = run.frame();

    project.write(CONFIG, '{ "columns": [');
    await run.change();

    const after = run.frame();
    expect(after.slice(0, -1)).toEqual(before.slice(0, -1));
    expect(after.at(-1)).toContain('! config: ');
    expect(after.at(-1)).toContain('! stale');
  });

  it('clears a task warning on the next fully readable task set', async () => {
    const project = board();
    const run = await start(project);

    project.write('.shipbench/tasks/broken.md', BROKEN_TASK);
    await run.change();
    expect(run.frame().at(-1)).toContain('! 1 warnings');
    expect(run.frame().at(-1)).not.toContain('! stale');

    project.remove('.shipbench/tasks/broken.md');
    await run.change();

    const status = run.frame().at(-1) ?? '';
    expect(status).not.toContain('!');
    expect(run.frame().join('\n')).toContain('First task');
  });

  it('renders a partial task read as a one-row warning without going stale', async () => {
    const project = board();
    const run = await start(project);

    project.write('.shipbench/tasks/broken.md', BROKEN_TASK);
    await run.change();

    for (const row of run.frame()) expect(row).not.toContain('\n');
    expect(run.frame().at(-1)).toContain('! 1 warnings');
    expect(run.frame().at(-1)).not.toContain('! stale');
  });

  it('repaints only the rows a new task touched', async () => {
    // The regression that matters: the diff degrades to a full-frame rewrite
    // silently. The board still looks right, it just costs 24 rows per event.
    const project = board();
    const run = await start(project, { columns: 100, rows: 24 });
    const at = run.tty.writes.length;

    // Oldest of the four, so `created` desc appends it below the other three
    // rather than shifting them all down a row.
    project.write(
      '.shipbench/tasks/fourth.md',
      taskFile('Fourth task', { created: '2026-05-01T00:00:00.000Z' }),
    );
    await run.change();

    const touched = rowsTouched(run.tty.writes.slice(at).join(''));
    // Row 1 is the column header, whose count went 3 → 4. Row 5 is where the
    // task landed. Row 24 is the status line, and only if the last-updated minute
    // changed between the two reads. Never the other twenty.
    expect(touched).toContain(5);
    expect(touched.every(row => [1, 5, 24].includes(row))).toBe(true);
    expect(run.frame()[4]).toContain('Fourth task');
  });
});

describe('dependency markers', () => {
  it('clears a marker when its dependency moves into the watched archive', async () => {
    const foundation = taskFile('Foundation', {
      created: '2026-06-01T00:00:00.000Z',
    });
    const project = createMemoryProject({
      [CONFIG]: JSON.stringify(TEST_CONFIG),
      '.shipbench/tasks/foundation.md': foundation,
      '.shipbench/tasks/dependent.md': taskFile('Dependent task', {
        depends_on: '[foundation]',
        created: '2026-06-02T00:00:00.000Z',
      }),
    });
    const run = await start(project, { columns: 100 });

    expect(run.frame().join('\n')).toContain('~Dependent task');

    project.remove('.shipbench/tasks/foundation.md');
    project.write('.shipbench/tasks/archive/foundation.md', foundation);
    await run.change();

    expect(run.frame().join('\n')).not.toContain('~Dependent task');
  });

  it('warns without blocking when an archived prerequisite is malformed', async () => {
    const project = createMemoryProject({
      [CONFIG]: JSON.stringify(TEST_CONFIG),
      '.shipbench/tasks/dependent.md': taskFile('Dependent task', {
        depends_on: '[foundation]',
      }),
      '.shipbench/tasks/archive/foundation.md':
        '---\ntitle: [unclosed\n---\n\nbody\n',
    });
    const run = await start(project, { columns: 100 });

    expect(run.frame().join('\n')).not.toContain('~Dependent task');
    expect(run.frame().at(-1)).toMatch(/! \d+ warnings/);
  });
});

describe('teardown', () => {
  it('closes the watcher and hands the terminal back', async () => {
    const run = await start(board());
    expect(run.tty.restored()).toBe('');

    await run.stop();

    expect(run.watcherClosed()).toBe(true);
    // The alternate screen is left, the cursor is back, and wrapping is on.
    expect(run.tty.restored()).toBe('\x1b[0m\x1b[?7h\x1b[?25h\x1b[?1049l');
    expect(run.tty.stream.listenerCount('resize')).toBe(0);
  });
});
