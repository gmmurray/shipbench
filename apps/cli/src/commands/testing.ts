/**
 * The in-memory harness the CLI tests share: a project that lives in a Map,
 * and a `createCli` wired to record what it writes to stdout and stderr.
 *
 * Nothing here is imported by `src/index.ts`, so none of it reaches `dist`.
 */

import type { StorageAdapter } from '@shipbench/core';
import matter from 'gray-matter';
import { createCli } from '../cli.js';

export function memoryAdapter(
  seed: Record<string, string> = {},
): StorageAdapter & { files: Map<string, string> } {
  const files = new Map(Object.entries(seed));
  return {
    files,
    readFile: async path => {
      const v = files.get(path);
      if (v === undefined) throw new Error(`ENOENT: ${path}`);
      return v;
    },
    readFileIfExists: async path => files.get(path) ?? null,
    writeFile: async (path, content) => {
      files.set(path, content);
    },
    deleteFile: async path => {
      files.delete(path);
    },
    listFiles: async dir => {
      const prefix = dir.endsWith('/') ? dir : `${dir}/`;
      return [...files.keys()]
        .filter(p => p.startsWith(prefix))
        .map(p => p.slice(prefix.length))
        .filter(path => !path.includes('/'));
    },
    readFiles: async paths => {
      const out = new Map<string, string>();
      for (const p of paths) {
        const v = files.get(p);
        if (v !== undefined) out.set(p, v);
      }
      return out;
    },
    writeFiles: async batch => {
      for (const [p, c] of batch) files.set(p, c);
    },
  };
}

export function setTaskUpdated(
  h: Harness,
  slug: string,
  updated: string,
): void {
  const path = `.shipbench/tasks/${slug}.md`;
  const raw = h.adapter.files.get(path);
  if (!raw) throw new Error(`Missing test task: ${slug}`);
  const parsed = matter(raw);
  parsed.data.updated = updated;
  h.adapter.files.set(path, matter.stringify(parsed.content, parsed.data));
}

export function setTaskCreated(
  h: Harness,
  slug: string,
  created: string,
): void {
  const path = `.shipbench/tasks/${slug}.md`;
  const raw = h.adapter.files.get(path);
  if (!raw) throw new Error(`Missing test task: ${slug}`);
  const parsed = matter(raw);
  parsed.data.created = created;
  h.adapter.files.set(path, matter.stringify(parsed.content, parsed.data));
}

export function setTaskBody(h: Harness, slug: string, body: string): void {
  const path = `.shipbench/tasks/${slug}.md`;
  const raw = h.adapter.files.get(path);
  if (!raw) throw new Error(`Missing test task: ${slug}`);
  const parsed = matter(raw);
  h.adapter.files.set(path, matter.stringify(body, parsed.data));
}

export interface Harness {
  adapter: ReturnType<typeof memoryAdapter>;
  stdout: string[];
  stderr: string[];
  run: (...argv: string[]) => Promise<void>;
}

export interface HarnessOptions {
  readTextFile?: (path: string) => Promise<string>;
  readStdin?: () => Promise<string>;
  isInteractive?: boolean;
  env?: NodeJS.ProcessEnv;
}

export function harness(
  seed?: Record<string, string>,
  options: HarnessOptions = {},
): Harness {
  const adapter = memoryAdapter(seed);
  const stdout: string[] = [];
  const stderr: string[] = [];
  const program = createCli({
    adapter,
    defaultProjectName: 'test-project',
    out: line => stdout.push(line),
    err: line => stderr.push(line),
    readTextFile: options.readTextFile,
    readStdin: options.readStdin,
    isInteractive: options.isInteractive,
    env: options.env,
    exitOverride: true,
  });
  return {
    adapter,
    stdout,
    stderr,
    run: async (...argv) => {
      await program.parseAsync(['node', 'shipbench', ...argv]);
    },
  };
}
