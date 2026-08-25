/**
 * Test doubles for the terminal view: a recording stand-in for a TTY, and a
 * project that lives entirely in a Map.
 *
 * Alternate-screen entry
 * and exit, cursor restoration, resize delivery, console mode — is about the
 * *effects* of those escape sequences. A real console has to be the thing that
 * switches screens or delivers a `resize`. The **bytes** are a separate
 * question, and an EventEmitter carrying `isTTY`, `columns`, `rows` and a
 * recording `write` answers it with no PTY and no async.
 *
 * The one piece a method cannot fake is `restore()`, which writes through
 * `fs.writeSync` to a file descriptor rather than to the stream — the whole
 * point being that it survives an event loop that is already dying. So `fd`
 * points at a real temp file, which both makes the restore bytes assertable and
 * keeps them off the test runner's own stdout. A fake with no `fd` inherits the
 * `?? 1` fallback and paints escape sequences over the reporter's output.
 *
 * Nothing here is imported by `src/index.ts`, so none of it reaches `dist`.
 */

import { EventEmitter } from 'node:events';
import {
  closeSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ReadableStorageAdapter } from '@shipbench/core';
import { ESC } from './style.js';

// ── The terminal ────────────────────────────────────────────────

export interface TestTerminalOptions {
  /** Defaults to true. False takes `runTui`'s piped path. */
  isTTY?: boolean;
  columns?: number;
  rows?: number;
}

export interface TestTerminal {
  stream: NodeJS.WriteStream;
  /** Every chunk handed to `stream.write`, in order. */
  writes: string[];
  /** The rows a terminal would be showing, after replaying every write. */
  frame(): string[];
  /** What `restore()` wrote through the file descriptor. */
  restored(): string;
  /** Change the size and deliver a `resize`, the way a console would. */
  resize(columns: number, rows: number): void;
  dispose(): void;
}

export function createTestTerminal(
  options: TestTerminalOptions = {},
): TestTerminal {
  const directory = mkdtempSync(join(tmpdir(), 'shipbench-tty-'));
  const path = join(directory, 'restore.log');
  const fd = openSync(path, 'w');

  const writes: string[] = [];
  const stream = Object.assign(new EventEmitter(), {
    isTTY: options.isTTY ?? true,
    columns: options.columns ?? 100,
    rows: options.rows ?? 24,
    fd,
    write(chunk: string): boolean {
      writes.push(chunk);
      return true;
    },
  });

  return {
    stream: stream as unknown as NodeJS.WriteStream,
    writes,
    frame: () => replay(writes),
    restored: () => readFileSync(path, 'utf-8'),
    resize(columns, rows) {
      stream.columns = columns;
      stream.rows = rows;
      stream.emit('resize');
    },
    dispose() {
      closeSync(fd);
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

/**
 * Reassemble the rows a terminal would be showing from a stream of diffed
 * writes. Painting only what changed means no single write is ever the frame,
 * so an assertion about what the operator can see has to replay them all.
 */
export function replay(writes: string[]): string[] {
  const rows: string[] = [];
  for (const chunk of writes) {
    // Screen entry and the resize repaint both blank everything; after either,
    // a row the next frame does not rewrite is genuinely empty.
    if (chunk.includes(ESC.eraseScreen) || chunk.includes(ESC.eraseBelow)) {
      rows.length = 0;
    }
    // `split` with a capturing group yields [before, row, content, row, …].
    const parts = chunk
      .replaceAll(ESC.syncStart, '')
      .replaceAll(ESC.syncEnd, '')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: reading back cursor addressing means matching the ESC byte.
      .split(/\x1b\[(\d+);1H\x1b\[K/);
    for (let i = 1; i < parts.length; i += 2) {
      rows[Number(parts[i]) - 1] = parts[i + 1] ?? '';
    }
  }
  return rows;
}

/** The 1-based rows a write addressed — the diff's cost, in rows. */
export function rowsTouched(chunk: string): number[] {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: same.
  const matches = chunk.matchAll(/\x1b\[(\d+);1H/g);
  return [...matches].map(match => Number(match[1]));
}

// ── The project ─────────────────────────────────────────────────

export interface MemoryProject {
  adapter: ReadableStorageAdapter;
  write(path: string, content: string): void;
  remove(path: string): void;
}

/**
 * A `ReadableStorageAdapter` over a Map. Deliberately not `FsAdapter` over a
 * temp directory: the read layer's failure cases are about *content* — a
 * config that is not JSON, a task file caught halfway through a write — and a
 * Map reaches them without a mkdtemp, a cleanup hook, or any filesystem
 * latency for a resilience test to race against.
 */
export function createMemoryProject(
  files: Record<string, string> = {},
): MemoryProject {
  const store = new Map(Object.entries(files));

  const adapter: ReadableStorageAdapter = {
    async readFile(path) {
      const content = store.get(path);
      if (content === undefined) {
        throw new Error(`ENOENT: no such file or directory, open '${path}'`);
      }
      return content;
    },
    async readFileIfExists(path) {
      return store.get(path) ?? null;
    },
    async listFiles(directory) {
      const prefix = `${directory}/`;
      return [...store.keys()]
        .filter(path => path.startsWith(prefix))
        .map(path => path.slice(prefix.length))
        .filter(name => !name.includes('/'));
    },
    async readFiles(paths) {
      const found = new Map<string, string>();
      for (const path of paths) {
        const content = store.get(path);
        if (content !== undefined) found.set(path, content);
      }
      return found;
    },
  };

  return {
    adapter,
    write: (path, content) => void store.set(path, content),
    remove: path => void store.delete(path),
  };
}

/** A partial config, exercising core's deep-merge the way a real one would. */
export const TEST_CONFIG = {
  version: 1,
  name: 'memory',
  columns: [
    { id: 'todo', label: 'To Do' },
    { id: 'in-progress', label: 'In Progress' },
    { id: 'done', label: 'Done' },
  ],
  default_column: 'todo',
  done_column: 'done',
};

export function taskFile(
  title: string,
  fields: Record<string, string> = {},
): string {
  const frontmatter: Record<string, string> = {
    title,
    status: 'todo',
    priority: 'medium',
    created: '2026-06-01T00:00:00.000Z',
    updated: '2026-06-01T00:00:00.000Z',
    ...fields,
  };
  const yaml = Object.entries(frontmatter)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
  return `---\n${yaml}\n---\n\n${title} body.\n`;
}
