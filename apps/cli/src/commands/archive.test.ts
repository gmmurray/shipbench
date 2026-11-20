import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FsAdapter } from '@shipbench/core';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { createCli } from '../cli.js';
import { harness, setTaskBody, setTaskUpdated } from './testing.js';

describe('shipbench task archive', () => {
  it('archives a single task', async () => {
    const h = harness();
    await h.run('init');
    await h.run('task', 'create', 'Stale task');
    h.stdout.length = 0;
    h.stderr.length = 0;

    await h.run('task', 'archive', 'stale-task');

    expect(h.stdout).toEqual([]);
    expect(h.stderr).toEqual(['Archived task: stale-task']);
    expect(h.adapter.files.has('.shipbench/tasks/stale-task.md')).toBe(false);
    expect(h.adapter.files.has('.shipbench/tasks/archive/stale-task.md')).toBe(
      true,
    );
  });

  it('reports live dependents and requires --force for a non-done task', async () => {
    const h = harness();
    await h.run('init');
    await h.run('task', 'create', 'Foundation');
    await h.run('task', 'create', 'Dependent', '--depends-on=foundation');

    await expect(h.run('task', 'archive', 'foundation')).rejects.toThrow(
      /dependent.*--force/i,
    );
    expect(h.adapter.files.has('.shipbench/tasks/foundation.md')).toBe(true);

    await h.run('task', 'archive', 'foundation', '--force');
    expect(h.adapter.files.has('.shipbench/tasks/archive/foundation.md')).toBe(
      true,
    );
  });

  it('names live tasks that link to the archived task without blocking', async () => {
    const h = harness();
    await h.run('init');
    await h.run('task', 'create', 'Decision', '--status=done');
    await h.run('task', 'create', 'Build');
    await h.run('task', 'create', 'Docs');
    setTaskBody(h, 'build', 'Follows [the decision](decision.md).');
    await h.run('task', 'comment', 'docs', 'See [it](./decision.md).');
    h.stdout.length = 0;
    h.stderr.length = 0;

    await h.run('task', 'archive', 'decision');

    expect(h.stdout).toEqual([]);
    expect(h.stderr).toEqual([
      'Archived task: decision',
      'Warning: build, docs link to decision, which is now at archive/decision.md. Update the link, or name decision in related.',
    ]);
    expect(h.adapter.files.has('.shipbench/tasks/archive/decision.md')).toBe(
      true,
    );
  });

  it('keeps --json stdout clean when warning about links', async () => {
    const h = harness();
    await h.run('init');
    await h.run('task', 'create', 'Decision', '--status=done');
    await h.run('task', 'create', 'Build');
    setTaskBody(h, 'build', 'Follows [the decision](decision.md).');
    h.stdout.length = 0;
    h.stderr.length = 0;

    await h.run('task', 'archive', 'decision', '--json');

    expect(JSON.parse(h.stdout.join('\n')).slug).toBe('decision');
    expect(h.stderr).toEqual([
      'Warning: build links to decision, which is now at archive/decision.md. Update the link, or name decision in related.',
    ]);
  });

  it('does not warn about links between tasks archived together', async () => {
    const h = harness();
    await h.run('init');
    h.adapter.files.delete('.shipbench/tasks/welcome-to-shipbench.md');
    await h.run('task', 'create', 'Decision', '--status=done');
    await h.run('task', 'create', 'Build', '--status=done');
    await h.run('task', 'create', 'Docs');
    setTaskBody(h, 'build', 'Follows [the decision](decision.md).');
    setTaskBody(h, 'docs', 'Documents [the build](build.md).');
    h.stdout.length = 0;
    h.stderr.length = 0;

    await h.run('task', 'archive', '--done', '--keep=0');

    expect(h.stderr).toEqual([
      'Archived task: build',
      'Archived task: decision',
      'Warning: docs links to build, which is now at archive/build.md. Update the link, or name build in related.',
    ]);
  });

  it('bulk-archives done tasks using done_display.max by default', async () => {
    const h = harness();
    await h.run('init');
    h.adapter.files.delete('.shipbench/tasks/welcome-to-shipbench.md');
    for (const title of ['Newest', 'Recent', 'Older', 'Oldest']) {
      await h.run('task', 'create', title, '--status=done');
    }
    setTaskUpdated(h, 'newest', '2026-04-01T00:00:00.000Z');
    setTaskUpdated(h, 'recent', '2026-03-01T00:00:00.000Z');
    setTaskUpdated(h, 'older', '2026-02-01T00:00:00.000Z');
    setTaskUpdated(h, 'oldest', '2026-01-01T00:00:00.000Z');

    const rawConfig = h.adapter.files.get('.shipbench/config.json');
    expect(rawConfig).toBeDefined();
    const config = JSON.parse(rawConfig!);
    config.done_display.max = 2;
    h.adapter.files.set(
      '.shipbench/config.json',
      `${JSON.stringify(config, null, 2)}\n`,
    );
    const configBefore = h.adapter.files.get('.shipbench/config.json');
    const layoutBefore = h.adapter.files.get('.shipbench/layout.json');
    h.stdout.length = 0;
    h.stderr.length = 0;

    await h.run('task', 'archive', '--done');

    expect(h.stdout).toEqual([]);
    expect(h.stderr).toEqual(['Archived task: older', 'Archived task: oldest']);
    expect(h.adapter.files.has('.shipbench/tasks/newest.md')).toBe(true);
    expect(h.adapter.files.has('.shipbench/tasks/recent.md')).toBe(true);
    expect(h.adapter.files.has('.shipbench/tasks/older.md')).toBe(false);
    expect(h.adapter.files.has('.shipbench/tasks/oldest.md')).toBe(false);
    expect(h.adapter.files.get('.shipbench/config.json')).toBe(configBefore);
    expect(h.adapter.files.get('.shipbench/layout.json')).toBe(layoutBefore);
  });

  it('bulk-archives done tasks using an explicit --keep count', async () => {
    const h = harness();
    await h.run('init');
    h.adapter.files.delete('.shipbench/tasks/welcome-to-shipbench.md');
    for (const title of ['Newest', 'Middle', 'Oldest']) {
      await h.run('task', 'create', title, '--status=done');
    }
    setTaskUpdated(h, 'newest', '2026-03-01T00:00:00.000Z');
    setTaskUpdated(h, 'middle', '2026-02-01T00:00:00.000Z');
    setTaskUpdated(h, 'oldest', '2026-01-01T00:00:00.000Z');
    h.stdout.length = 0;
    h.stderr.length = 0;

    await h.run('task', 'archive', '--done', '--keep=1');

    expect(h.stdout).toEqual([]);
    expect(h.stderr).toEqual([
      'Archived task: middle',
      'Archived task: oldest',
    ]);
    expect(h.adapter.files.has('.shipbench/tasks/newest.md')).toBe(true);
  });

  it('documents the dependent-task guard in help output', async () => {
    const h = harness();

    await expect(h.run('task', 'archive', '--help')).rejects.toMatchObject({
      code: 'commander.helpDisplayed',
      exitCode: 0,
    });
    expect(h.stdout.join('\n')).toMatch(/live dependents.*--force/i);
  });
});

describe('shipbench task unarchive', () => {
  it('restores an archived task', async () => {
    const h = harness();
    await h.run('init');
    await h.run('task', 'create', 'Restore me');
    await h.run('task', 'archive', 'restore-me');
    h.stdout.length = 0;
    h.stderr.length = 0;

    await h.run('task', 'unarchive', 'restore-me');

    expect(h.stdout).toEqual([]);
    expect(h.stderr).toEqual(['Unarchived task: restore-me']);
    expect(h.adapter.files.has('.shipbench/tasks/restore-me.md')).toBe(true);
    expect(h.adapter.files.has('.shipbench/tasks/archive/restore-me.md')).toBe(
      false,
    );
  });
});

describe('task archive commands on a real filesystem', () => {
  it('archives, lists, and restores files in a real .shipbench directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'shipbench-cli-archive-'));
    const stdout: string[] = [];
    const program = createCli({
      adapter: new FsAdapter(root),
      defaultProjectName: 'filesystem-test',
      cwd: root,
      out: line => stdout.push(line),
      exitOverride: true,
    });
    const run = async (...argv: string[]) => {
      await program.parseAsync(['node', 'shipbench', ...argv]);
    };

    try {
      await run('init');
      await run('task', 'create', 'Filesystem task');
      await run('task', 'archive', 'filesystem-task');
      stdout.length = 0;

      await run('task', 'list', '--archived', '--json');
      const payload = JSON.parse(stdout.join('\n'));
      expect(payload.tasks).toEqual([
        expect.objectContaining({ slug: 'filesystem-task' }),
      ]);

      await run('task', 'unarchive', 'filesystem-task');
      const adapter = new FsAdapter(root);
      await expect(
        adapter.readFile('.shipbench/tasks/filesystem-task.md'),
      ).resolves.toContain('title: Filesystem task');
      await expect(
        adapter.readFile('.shipbench/tasks/archive/filesystem-task.md'),
      ).rejects.toThrow();

      await run('task', 'create', 'Foundation');
      await run('task', 'create', 'Dependent', '--depends-on=foundation');
      await expect(run('task', 'archive', 'foundation')).rejects.toThrow(
        /dependent.*--force/i,
      );
      await run('task', 'archive', 'foundation', '--force');

      const config = JSON.parse(
        await adapter.readFile('.shipbench/config.json'),
      );
      config.done_display.max = 1;
      await adapter.writeFile(
        '.shipbench/config.json',
        `${JSON.stringify(config, null, 2)}\n`,
      );
      await run('task', 'create', 'Done newest', '--status=done');
      await run('task', 'create', 'Done oldest', '--status=done');
      const oldestPath = '.shipbench/tasks/done-oldest.md';
      const oldest = matter(await adapter.readFile(oldestPath));
      oldest.data.updated = '2020-01-01T00:00:00.000Z';
      await adapter.writeFile(
        oldestPath,
        matter.stringify(oldest.content, oldest.data),
      );

      await run('task', 'archive', '--done');
      await expect(adapter.readFile(oldestPath)).rejects.toThrow();
      await expect(
        adapter.readFile('.shipbench/tasks/archive/done-oldest.md'),
      ).resolves.toContain('title: Done oldest');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('shipbench task delete', () => {
  it('deletes a task', async () => {
    const h = harness();
    await h.run('init');
    await h.run('task', 'delete', 'welcome-to-shipbench');
    expect(
      h.adapter.files.has('.shipbench/tasks/welcome-to-shipbench.md'),
    ).toBe(false);
  });

  it('refuses a slug that reaches outside the tasks directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'shipbench-cli-slug-'));
    const readme = join(root, 'README.md');
    const program = createCli({
      adapter: new FsAdapter(root),
      defaultProjectName: 'slug-test',
      cwd: root,
      out: () => {},
      err: () => {},
      exitOverride: true,
    });

    try {
      await program.parseAsync(['node', 'shipbench', 'init']);
      await writeFile(readme, '# Keep me', 'utf-8');

      await expect(
        program.parseAsync([
          'node',
          'shipbench',
          'task',
          'delete',
          '../../README',
        ]),
      ).rejects.toThrow(/Invalid task slug "..\/..\/README"/);
      await expect(readFile(readme, 'utf-8')).resolves.toBe('# Keep me');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
