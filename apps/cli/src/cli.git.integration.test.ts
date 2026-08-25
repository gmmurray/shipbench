import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { FsAdapter } from '@shipbench/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCli } from './cli.js';

const execFileAsync = promisify(execFile);
const roots: string[] = [];
const connectUrl =
  'https://harbor.shipbench.dev/projects/project-1/connect?token=integration-secret';

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
  });
  return stdout.trim();
}

async function makeGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'shipbench-connect-'));
  roots.push(root);
  await git(root, 'init');
  await git(root, 'config', 'user.name', 'ShipBench Tests');
  await git(root, 'config', 'user.email', 'shipbench-tests@example.com');
  await git(root, 'branch', '-M', 'main');
  return root;
}

function cliHarness(root: string, fetchImpl: typeof fetch) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const program = createCli({
    adapter: new FsAdapter(root),
    defaultProjectName: 'integration-project',
    cwd: root,
    fetch: fetchImpl,
    out: line => stdout.push(line),
    err: line => stderr.push(line),
    exitOverride: true,
  });
  return {
    stdout,
    stderr,
    run: async (...argv: string[]) => {
      await program.parseAsync(['node', 'shipbench', ...argv]);
    },
  };
}

function successfulFetch() {
  return vi.fn(async () =>
    Response.json({ message: 'Connected integration project.' }),
  );
}

async function snapshotProject(
  adapter: FsAdapter,
  paths: string[],
): Promise<Map<string, string>> {
  return new Map(
    await Promise.all(
      paths.map(async path => [path, await adapter.readFile(path)] as const),
    ),
  );
}

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop()!;
    await rm(root, { recursive: true, force: true });
  }
});

describe('Harbor connect in temporary Git repositories', () => {
  it('initializes and connects a new repo without requiring an upstream', async () => {
    const root = await makeGitRepo();
    await git(
      root,
      'remote',
      'add',
      'origin',
      'git@github.com:shipbench/integration.git',
    );
    const fetch = successfulFetch();
    const h = cliHarness(root, fetch as typeof globalThis.fetch);

    await h.run('init', `--harbor=${connectUrl}`);

    await expect(
      new FsAdapter(root).readFile('.shipbench/config.json'),
    ).resolves.toContain('"name": "integration-project"');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(h.stderr.join('\n')).toMatch(/absent from HEAD/i);
    expect(h.stderr.join('\n')).toMatch(/uncommitted changes/i);
    expect(h.stderr.join('\n')).toMatch(/no upstream/i);
  });

  it('keeps initialization when a new repo has no origin and does not fetch', async () => {
    const root = await makeGitRepo();
    const fetch = successfulFetch();
    const h = cliHarness(root, fetch as typeof globalThis.fetch);

    await expect(h.run('init', `--harbor=${connectUrl}`)).rejects.toMatchObject(
      {
        exitCode: 2,
        message: expect.stringContaining('initialization completed'),
      },
    );

    await expect(
      new FsAdapter(root).readFile('.shipbench/config.json'),
    ).resolves.toContain('"name": "integration-project"');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('connects an existing committed project without changing its files', async () => {
    const root = await makeGitRepo();
    const fetch = successfulFetch();
    const h = cliHarness(root, fetch as typeof globalThis.fetch);
    const adapter = new FsAdapter(root);
    await h.run('init');
    await adapter.writeFile('.shipbench/README.md', '# User-owned README\r\n');
    await git(root, 'add', '.shipbench');
    await git(root, 'commit', '-m', 'Initialize ShipBench');
    await git(
      root,
      'remote',
      'add',
      'origin',
      'https://github.com/shipbench/integration.git',
    );
    const paths = [
      '.shipbench/config.json',
      '.shipbench/layout.json',
      '.shipbench/README.md',
      '.shipbench/AGENTS.md',
      '.shipbench/tasks/welcome-to-shipbench.md',
    ];
    const before = await snapshotProject(adapter, paths);
    h.stdout.length = 0;
    h.stderr.length = 0;

    await h.run('connect', `--harbor=${connectUrl}`);

    expect(await snapshotProject(adapter, paths)).toEqual(before);
    expect(h.stdout).toEqual([]);
    expect(h.stderr).toContain('Connected integration project.');
    expect(h.stderr.join('\n')).toMatch(/no upstream/i);
  });

  it('warns when committed ShipBench changes are ahead of upstream', async () => {
    const root = await makeGitRepo();
    const fetch = successfulFetch();
    const h = cliHarness(root, fetch as typeof globalThis.fetch);
    const adapter = new FsAdapter(root);
    await h.run('init');
    await git(root, 'add', '.shipbench');
    await git(root, 'commit', '-m', 'Initialize ShipBench');
    await git(
      root,
      'remote',
      'add',
      'origin',
      'https://github.com/shipbench/integration.git',
    );
    await git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    await git(root, 'branch', '--set-upstream-to=origin/main', 'main');
    await adapter.writeFile(
      '.shipbench/tasks/ahead.md',
      `---
title: Ahead
status: todo
created: 2026-01-01T00:00:00.000Z
updated: 2026-01-01T00:00:00.000Z
---
`,
    );
    await git(root, 'add', '.shipbench/tasks/ahead.md');
    await git(root, 'commit', '-m', 'Add local task');
    h.stdout.length = 0;
    h.stderr.length = 0;

    await h.run('connect', `--harbor=${connectUrl}`);

    expect(h.stderr.join('\n')).toMatch(/1 commit ahead/i);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
