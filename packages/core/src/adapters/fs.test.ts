import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FsAdapter } from './fs.js';

describe('FsAdapter', () => {
  let root: string;
  let adapter: FsAdapter;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'shipbench-fs-'));
    adapter = new FsAdapter(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('round-trips readFile/writeFile', async () => {
    await adapter.writeFile('hello.txt', 'world');
    expect(await adapter.readFile('hello.txt')).toBe('world');
  });

  it('readFileIfExists returns content or null for a missing file', async () => {
    await adapter.writeFile('present.txt', 'here');

    await expect(adapter.readFileIfExists('present.txt')).resolves.toBe('here');
    await expect(adapter.readFileIfExists('missing.txt')).resolves.toBeNull();
  });

  it('creates parent directories on writeFile', async () => {
    await adapter.writeFile('.shipbench/tasks/foo.md', 'body');
    expect(await adapter.readFile('.shipbench/tasks/foo.md')).toBe('body');
  });

  it('writes UTF-8 content correctly', async () => {
    const content = '# café — naïve résumé\n';
    await adapter.writeFile('utf8.md', content);
    // Verify via direct fs read that the bytes hit disk as UTF-8.
    const raw = await readFile(join(root, 'utf8.md'), 'utf-8');
    expect(raw).toBe(content);
    expect(await adapter.readFile('utf8.md')).toBe(content);
  });

  it('listFiles returns basenames only', async () => {
    await adapter.writeFile('.shipbench/tasks/a.md', '');
    await adapter.writeFile('.shipbench/tasks/b.md', '');
    const files = await adapter.listFiles('.shipbench/tasks');
    expect(files.sort()).toEqual(['a.md', 'b.md']);
  });

  it('listFiles returns [] for a missing directory', async () => {
    expect(await adapter.listFiles('nope')).toEqual([]);
  });

  it('listFiles includes non-.md entries (caller filters)', async () => {
    await adapter.writeFile('.shipbench/tasks/a.md', '');
    await adapter.writeFile('.shipbench/tasks/notes.txt', '');
    const files = await adapter.listFiles('.shipbench/tasks');
    expect(files.sort()).toEqual(['a.md', 'notes.txt']);
  });

  it('deleteFile removes the file', async () => {
    await adapter.writeFile('gone.md', '');
    await adapter.deleteFile('gone.md');
    await expect(adapter.readFile('gone.md')).rejects.toThrow();
  });

  it('readFiles returns a map keyed by the requested paths', async () => {
    await adapter.writeFile('a.md', 'A');
    await adapter.writeFile('b.md', 'B');
    const result = await adapter.readFiles(['a.md', 'b.md']);
    expect(result.get('a.md')).toBe('A');
    expect(result.get('b.md')).toBe('B');
    expect(result.size).toBe(2);
  });

  it('writeFiles writes every entry in the batch', async () => {
    await adapter.writeFiles(
      new Map([
        ['.shipbench/config.json', '{}'],
        ['.shipbench/tasks/a.md', 'A'],
      ]),
    );
    expect(await adapter.readFile('.shipbench/config.json')).toBe('{}');
    expect(await adapter.readFile('.shipbench/tasks/a.md')).toBe('A');
  });

  it('does not interfere with files outside the rootDir', async () => {
    // Sanity check: writes go inside root, not somewhere relative to cwd.
    await adapter.writeFile('x.txt', 'inside');
    const raw = await readFile(join(root, 'x.txt'), 'utf-8');
    expect(raw).toBe('inside');
  });

  it('overwrites existing files', async () => {
    await adapter.writeFile('x.txt', 'one');
    await adapter.writeFile('x.txt', 'two');
    expect(await adapter.readFile('x.txt')).toBe('two');
  });

  it('survives a pre-existing file at the target path being overwritten via writeFile', async () => {
    // Make sure that writing into a dir that exists doesn't fail.
    await writeFile(join(root, 'pre.txt'), 'pre');
    await adapter.writeFile('pre.txt', 'post');
    expect(await adapter.readFile('pre.txt')).toBe('post');
  });
});
