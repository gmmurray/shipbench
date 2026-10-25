import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createProcessCli,
  resolveBoard,
  resolveProjectDirectory,
} from './processCli.js';

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'shipbench-cli-cwd-'));
  temporaryDirectories.push(directory);
  return directory;
}

function argv(...args: string[]): string[] {
  return ['node', 'shipbench', ...args];
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(directory => rm(directory, { recursive: true, force: true })),
  );
});

describe('resolveProjectDirectory', () => {
  it('preserves the shell working directory when -C is absent', async () => {
    const shellCwd = await temporaryDirectory();
    expect(resolveProjectDirectory(argv('task', 'list'), shellCwd)).toBe(
      shellCwd,
    );
  });

  it('resolves relative and attached -C values against the shell cwd', async () => {
    const shellCwd = await temporaryDirectory();
    const project = join(shellCwd, 'projects', 'example');
    await mkdir(project, { recursive: true });

    expect(
      resolveProjectDirectory(
        argv('-C', join('projects', 'example'), 'task', 'list'),
        shellCwd,
      ),
    ).toBe(project);
    expect(
      resolveProjectDirectory(
        argv(`-C${join('projects', 'example')}`, 'task', 'list'),
        shellCwd,
      ),
    ).toBe(project);
  });

  it('accepts an absolute directory', async () => {
    const shellCwd = await temporaryDirectory();
    const project = await temporaryDirectory();
    expect(
      resolveProjectDirectory(argv('-C', project, 'task', 'list'), shellCwd),
    ).toBe(resolve(project));
  });

  it('does not treat arguments after the command or -- as root options', async () => {
    const shellCwd = await temporaryDirectory();
    expect(
      resolveProjectDirectory(
        argv('task', 'create', '-C', 'not-a-directory'),
        shellCwd,
      ),
    ).toBe(shellCwd);
    expect(
      resolveProjectDirectory(argv('--', '-C', 'not-a-directory'), shellCwd),
    ).toBe(shellCwd);
  });

  it('rejects a missing path with the resolved path in the message', async () => {
    const shellCwd = await temporaryDirectory();
    const missing = join(shellCwd, 'missing');
    expect(() =>
      resolveProjectDirectory(argv('-C', 'missing', 'task', 'list'), shellCwd),
    ).toThrow(`ShipBench project directory does not exist: ${missing}`);
  });

  it('rejects a path that is not a directory', async () => {
    const shellCwd = await temporaryDirectory();
    const file = join(shellCwd, 'project.txt');
    await writeFile(file, 'not a directory');
    expect(() =>
      resolveProjectDirectory(argv('-C', file, 'task', 'list'), shellCwd),
    ).toThrow(`ShipBench project path is not a directory: ${file}`);
  });
});

describe('createProcessCli', () => {
  it('runs commands against -C and derives the init name from that directory', async () => {
    const shellCwd = await temporaryDirectory();
    const project = join(shellCwd, 'nested', 'target-project');
    await mkdir(project, { recursive: true });

    const initArgv = argv('-C', project, 'init');
    const init = createProcessCli({
      argv: initArgv,
      shellCwd,
      out: () => {},
      exitOverride: true,
    });
    await init.parseAsync(initArgv);

    const config = JSON.parse(
      await readFile(join(project, '.shipbench', 'config.json'), 'utf8'),
    );
    expect(config.name).toBe(basename(project));

    const createArgv = argv('-C', project, 'task', 'create', 'Target task');
    const create = createProcessCli({
      argv: createArgv,
      shellCwd,
      out: () => {},
      exitOverride: true,
    });
    await create.parseAsync(createArgv);

    const stdout: string[] = [];
    const listArgv = argv('-C', project, 'task', 'list', '--json');
    const list = createProcessCli({
      argv: listArgv,
      shellCwd,
      out: line => stdout.push(line),
      exitOverride: true,
    });
    await list.parseAsync(listArgv);

    const payload = JSON.parse(stdout.join('\n'));
    expect(payload.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: 'target-task' }),
      ]),
    );
    await expect(
      readFile(join(shellCwd, '.shipbench', 'config.json'), 'utf8'),
    ).rejects.toThrow();
  });
});

interface Run {
  stdout: string[];
  stderr: string[];
  error?: Error;
}

async function run(shellCwd: string, ...args: string[]): Promise<Run> {
  const result: Run = { stdout: [], stderr: [] };
  const commandArgv = argv(...args);
  try {
    await createProcessCli({
      argv: commandArgv,
      shellCwd,
      out: line => result.stdout.push(line),
      err: line => result.stderr.push(line),
      exitOverride: true,
    }).parseAsync(commandArgv);
  } catch (error) {
    result.error = error as Error;
  }
  return result;
}

/** A checkout at `<tmp>/repo` with a board at its top level. */
async function repositoryWithBoard(): Promise<string> {
  const repo = join(await temporaryDirectory(), 'repo');
  await mkdir(join(repo, '.git'), { recursive: true });
  const init = await run(repo, 'init');
  expect(init.error).toBeUndefined();
  return repo;
}

describe('board discovery', () => {
  it('finds the board above a subdirectory and names it only on writes', async () => {
    const repo = await repositoryWithBoard();
    const src = join(repo, 'src', 'deep');
    await mkdir(src, { recursive: true });

    expect(resolveBoard(argv('task', 'list'), src).directory).toBe(repo);

    const create = await run(src, 'task', 'create', 'From below');
    expect(create.error).toBeUndefined();
    expect(create.stderr).toContain(`Using .shipbench/ from ${repo}`);
    await expect(
      readFile(join(repo, '.shipbench', 'tasks', 'from-below.md'), 'utf8'),
    ).resolves.toContain('From below');

    const list = await run(src, 'task', 'list', '--json');
    expect(list.error).toBeUndefined();
    expect(list.stderr.join('\n')).not.toContain('Using .shipbench/');
    expect(JSON.parse(list.stdout.join('\n')).tasks).toEqual(
      expect.arrayContaining([expect.objectContaining({ slug: 'from-below' })]),
    );
  });

  it('says nothing extra when the command runs at the board root', async () => {
    const repo = await repositoryWithBoard();
    const create = await run(repo, 'task', 'create', 'At the root');
    expect(create.error).toBeUndefined();
    expect(create.stderr.join('\n')).not.toContain('Using .shipbench/');
  });

  it('prefers the nearest of nested boards', async () => {
    const repo = await repositoryWithBoard();
    const api = join(repo, 'packages', 'api');
    await mkdir(api, { recursive: true });
    expect((await run(api, 'init')).error).toBeUndefined();
    const src = join(api, 'src');
    await mkdir(src);

    expect(resolveBoard(argv('task', 'list'), src).directory).toBe(api);
    expect(
      resolveBoard(argv('task', 'list'), join(repo, 'packages')).directory,
    ).toBe(repo);
  });

  it('stops at a .shipbench/ without config.json instead of using the board above', async () => {
    const repo = await repositoryWithBoard();
    const api = join(repo, 'api');
    await mkdir(join(api, '.shipbench', 'tasks'), { recursive: true });
    const src = join(api, 'src');
    await mkdir(src);

    const list = await run(src, 'task', 'list');
    expect(list.error?.message).toBe(
      `No .shipbench/config.json found in ${api}. Run shipbench init first.`,
    );
  });

  it('never leaves a linked worktree, even one inside the main checkout', async () => {
    const repo = await repositoryWithBoard();
    const worktree = join(repo, '.worktrees', 'feature');
    await mkdir(join(worktree, 'src'), { recursive: true });
    await writeFile(
      join(worktree, '.git'),
      'gitdir: ../../.git/worktrees/feature\n',
    );

    const list = await run(join(worktree, 'src'), 'task', 'list');
    expect(list.error?.message).toBe(
      `No .shipbench/config.json found in ${join(worktree, 'src')} or above it up to ${worktree}. Run shipbench init first.`,
    );
  });

  it('replaces the raw ENOENT when the walk starts at the top level', async () => {
    const repo = join(await temporaryDirectory(), 'repo');
    await mkdir(join(repo, '.git'), { recursive: true });
    const list = await run(repo, 'task', 'list');
    expect(list.error?.message).toBe(
      `No .shipbench/config.json found in ${repo}. Run shipbench init first.`,
    );
  });

  it('uses -C exactly, without searching above it', async () => {
    const repo = await repositoryWithBoard();
    const src = join(repo, 'src');
    await mkdir(src);

    const list = await run(repo, '-C', 'src', 'task', 'list');
    expect(list.error?.message).toBe(
      `No .shipbench/config.json found in ${src}. Run shipbench init first.`,
    );
  });

  it('applies the same message to both board views', async () => {
    const repo = join(await temporaryDirectory(), 'repo');
    await mkdir(join(repo, '.git'), { recursive: true });
    const message = `No .shipbench/config.json found in ${repo}. Run shipbench init first.`;
    expect((await run(repo, 'board', '--no-open')).error?.message).toBe(
      message,
    );
    expect((await run(repo, 'board', 'terminal')).error?.message).toBe(message);
  });

  it('keeps help working outside any board', async () => {
    const repo = join(await temporaryDirectory(), 'repo');
    await mkdir(join(repo, '.git'), { recursive: true });
    const help = await run(repo, 'task', '--help');
    expect(help.stdout.join('\n')).toContain('Manage tasks');
  });

  it('creates a board in a subdirectory with init and names the one above', async () => {
    const repo = await repositoryWithBoard();
    const api = join(repo, 'api');
    await mkdir(api);

    const init = await run(api, 'init');
    expect(init.error).toBeUndefined();
    await expect(
      readFile(join(api, '.shipbench', 'config.json'), 'utf8'),
    ).resolves.toContain('"api"');
    expect(init.stderr.join('\n')).toContain(
      `Note: ${repo} already has a .shipbench/ board.`,
    );
  });

  it('does not name a board outside the checkout init runs at the top of', async () => {
    const repo = await repositoryWithBoard();
    const inner = join(repo, 'vendor', 'other');
    await mkdir(join(inner, '.git'), { recursive: true });

    const init = await run(inner, 'init');
    expect(init.error).toBeUndefined();
    expect(init.stderr.join('\n')).not.toContain('Note:');
  });
});
