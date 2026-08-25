import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createProcessCli, resolveProjectDirectory } from './processCli.js';

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
