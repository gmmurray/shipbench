import { beforeEach, describe, expect, it } from 'vitest';
import { createCli } from './cli.js';
import { type Harness, harness, memoryAdapter } from './commands/testing.js';

describe('removed commands', () => {
  it('rejects connect as an unknown command', async () => {
    const h = harness();

    await expect(
      h.run('connect', '--harbor=https://example.com/connect'),
    ).rejects.toMatchObject({ code: 'commander.unknownCommand' });
  });
});

describe('--json on every task command', () => {
  let h: Harness;
  beforeEach(async () => {
    h = harness();
    await h.run('init');
    h.adapter.files.delete('.shipbench/tasks/welcome-to-shipbench.md');
    await h.run('task', 'create', 'Build api');
    await h.run('task', 'create', 'Ship auth');
    h.stdout.length = 0;
    h.stderr.length = 0;
  });

  const printed = () => {
    const payload = JSON.parse(h.stdout.join('\n'));
    h.stdout.length = 0;
    return payload;
  };

  it('accepts --json on every task subcommand, so a guess is never refused', () => {
    const program = createCli({
      adapter: memoryAdapter(),
      defaultProjectName: 'test-project',
      out: () => {},
      err: () => {},
      exitOverride: true,
    });
    const task = program.commands.find(command => command.name() === 'task')!;
    const missing: string[] = [];
    const visit = (command: typeof task, path: string) => {
      if (!command.options.some(option => option.long === '--json')) {
        missing.push(path);
      }
      for (const child of command.commands) {
        visit(child, `${path} ${child.name()}`);
      }
    };
    for (const command of task.commands) visit(command, command.name());
    expect(missing).toEqual([]);
  });

  it('prints the same task from get with or without --json', async () => {
    await h.run('task', 'get', 'build-api');
    const plain = printed();
    await h.run('task', 'get', 'build-api', '--json');
    expect(printed()).toEqual(plain);
    await h.run('task', 'show', 'build-api', '--json');
    expect(printed()).toEqual(plain);

    await h.run('task', 'archive', 'build-api');
    await h.run('task', 'get', 'build-api', '--archived', '--json');
    expect(printed()).toEqual(plain);
  });

  it('prints the moved task, with or without a placement flag', async () => {
    await h.run('task', 'move', 'build-api', '--to=in-progress', '--json');
    expect(printed()).toMatchObject({
      slug: 'build-api',
      status: 'in-progress',
    });
    await h.run(
      'task',
      'move',
      'ship-auth',
      '--to=in-progress',
      '--top',
      '--json',
    );
    expect(printed()).toMatchObject({
      slug: 'ship-auth',
      status: 'in-progress',
    });
    expect(h.stderr).toEqual([]);
  });

  it('prints the task after each Updates write', async () => {
    await h.run('task', 'comment', 'build-api', 'First.', '--json');
    expect(printed().comments).toEqual([
      expect.objectContaining({ text: 'First.' }),
    ]);
    await h.run(
      'task',
      'comment',
      'edit',
      'build-api',
      '0',
      'Fixed.',
      '--json',
    );
    expect(printed().comments).toEqual([
      expect.objectContaining({ text: 'Fixed.' }),
    ]);
    await h.run('task', 'comment', 'delete', 'build-api', '0', '--json');
    expect(printed().comments).toEqual([]);
    expect(h.stderr).toEqual([]);
  });

  it('prints the task after flag and unflag, including a no-op', async () => {
    await h.run('task', 'flag', 'build-api', 'Waiting', '--json');
    expect(printed().frontmatter.flag).toBe('Waiting');
    await h.run('task', 'flag', 'build-api', 'Waiting', '--json');
    expect(printed().frontmatter.flag).toBe('Waiting');
    await h.run('task', 'unflag', 'build-api', '--json');
    expect(printed().frontmatter).not.toHaveProperty('flag');
    await h.run('task', 'unflag', 'build-api', '--json');
    expect(printed().slug).toBe('build-api');
    expect(h.stderr).toEqual([]);
  });

  it('prints the archived and restored task', async () => {
    await h.run('task', 'archive', 'build-api', '--json');
    expect(printed().slug).toBe('build-api');
    await h.run('task', 'unarchive', 'build-api', '--json');
    expect(printed().slug).toBe('build-api');
    expect(h.stderr).toEqual([]);
  });

  it('prints an array from a bulk archive, empty when nothing qualifies', async () => {
    await h.run('task', 'archive', '--done', '--json');
    expect(printed()).toEqual([]);

    await h.run('task', 'move', 'build-api', '--to=done');
    await h.run('task', 'archive', '--done', '--keep=0', '--json');
    expect(printed().map((task: { slug: string }) => task.slug)).toEqual([
      'build-api',
    ]);
    expect(h.stderr).toEqual(['Moved build-api → done']);
  });

  it('prints the deleted slug', async () => {
    await h.run('task', 'delete', 'build-api', '--json');
    expect(printed()).toEqual({ slug: 'build-api', deleted: true });
    expect(h.stderr).toEqual([]);
  });
});

describe('--help and --version', () => {
  it('exits cleanly on --help (exit code 0)', async () => {
    const h = harness();
    await expect(h.run('--help')).rejects.toMatchObject({
      code: 'commander.helpDisplayed',
      exitCode: 0,
    });
    expect(h.stdout.join('\n')).toContain('-C <path>');
    expect(h.stdout.join('\n')).toContain(
      'Git-native project management for solo developers.',
    );
  });

  it('prints the version on --version', async () => {
    const h = harness();
    await expect(h.run('--version')).rejects.toMatchObject({
      code: 'commander.version',
      exitCode: 0,
    });
    // Build-time define isn't applied to vitest runs; fallback is '0.0.0-dev'.
    expect(h.stdout.join('\n')).toMatch(/0\.0\.0-dev/);
  });
});
