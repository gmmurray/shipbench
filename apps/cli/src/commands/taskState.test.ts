import matter from 'gray-matter';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  type Harness,
  harness,
  setTaskCreated,
  setTaskUpdated,
} from './testing.js';

describe('shipbench task flag and unflag', () => {
  let h: Harness;
  beforeEach(async () => {
    h = harness();
    await h.run('init');
    h.adapter.files.delete('.shipbench/tasks/welcome-to-shipbench.md');
    await h.run('task', 'create', 'Build api', '--status=in-progress');
    await h.run('task', 'create', 'Ship auth');
    setTaskUpdated(h, 'build-api', '2026-01-01T00:00:00.000Z');
    h.stdout.length = 0;
    h.stderr.length = 0;
  });

  const frontmatter = (slug = 'build-api') =>
    matter(h.adapter.files.get(`.shipbench/tasks/${slug}.md`)!).data;

  it('flags a task with a reason, leaving its column alone', async () => {
    await h.run('task', 'flag', 'build-api', 'Waiting on credentials');

    expect(frontmatter()).toMatchObject({
      status: 'in-progress',
      flag: 'Waiting on credentials',
    });
    expect(Date.parse(frontmatter().updated)).toBeGreaterThan(
      Date.parse('2026-01-01T00:00:00.000Z'),
    );
    expect(h.stderr).toEqual(['Flagged build-api: Waiting on credentials']);
    expect(h.stdout).toEqual([]);
  });

  it('flags a task without a reason as `flag: true`', async () => {
    await h.run('task', 'flag', 'build-api');

    expect(frontmatter().flag).toBe(true);
    expect(h.stderr).toEqual(['Flagged build-api']);
  });

  it('replaces the reason on a flagged task, and skips a no-op', async () => {
    await h.run('task', 'flag', 'build-api', 'First');
    await h.run('task', 'flag', 'build-api', 'Second');
    expect(frontmatter().flag).toBe('Second');

    setTaskUpdated(h, 'build-api', '2026-01-01T00:00:00.000Z');
    h.stderr.length = 0;
    await h.run('task', 'flag', 'build-api', 'Second');
    expect(frontmatter().updated).toBe('2026-01-01T00:00:00.000Z');
    expect(h.stderr).toEqual([
      'No changes for build-api: it already carries that flag.',
    ]);
  });

  it('rejects a blank reason without writing', async () => {
    const before = h.adapter.files.get('.shipbench/tasks/build-api.md');
    await expect(h.run('task', 'flag', 'build-api', '  ')).rejects.toThrow(
      /reason is blank/,
    );
    expect(h.adapter.files.get('.shipbench/tasks/build-api.md')).toBe(before);
  });

  it('unflags a task by removing the field', async () => {
    await h.run('task', 'flag', 'build-api', 'Stuck');
    h.stderr.length = 0;
    await h.run('task', 'unflag', 'build-api');

    expect(frontmatter()).not.toHaveProperty('flag');
    expect(h.stderr).toEqual(['Unflagged build-api']);
  });

  it('treats unflagging an unflagged task as a no-op', async () => {
    await h.run('task', 'unflag', 'ship-auth');

    expect(h.stderr).toEqual(['No changes for ship-auth: it is not flagged.']);
  });

  it('names an archived task rather than calling it missing', async () => {
    await h.run('task', 'archive', 'ship-auth');
    await expect(h.run('task', 'flag', 'ship-auth')).rejects.toThrow(
      "Task 'ship-auth' is archived. Unarchive it before flagging.",
    );
    await expect(h.run('task', 'unflag', 'nope')).rejects.toThrow(
      "Task 'nope' not found.",
    );
  });

  it('filters list and search to flagged tasks and marks them in text', async () => {
    await h.run('task', 'flag', 'build-api', 'Needs a decision');
    h.stdout.length = 0;

    await h.run('task', 'list', '--flagged', '--json');
    const listed = JSON.parse(h.stdout.join('\n'));
    expect(listed.tasks).toEqual([
      expect.objectContaining({
        slug: 'build-api',
        flag: 'Needs a decision',
      }),
    ]);

    h.stdout.length = 0;
    await h.run('task', 'list');
    expect(h.stdout).toContain(
      '[in-progress] Build api (build-api) — flagged: Needs a decision',
    );
    expect(h.stdout).toContain('[todo] Ship auth (ship-auth)');

    h.stdout.length = 0;
    await h.run('task', 'search', 'a', '--flagged', '--json');
    const searched = JSON.parse(h.stdout.join('\n'));
    expect(searched.matches).toEqual([
      expect.objectContaining({
        slug: 'build-api',
        flag: 'Needs a decision',
      }),
    ]);

    h.stdout.length = 0;
    await h.run('task', 'search', 'auth');
    expect(h.stdout[0]).not.toContain('flagged');
  });
});

describe('shipbench task move', () => {
  it('moves a task to a new status', async () => {
    const h = harness();
    await h.run('init');
    const configBefore = h.adapter.files.get('.shipbench/config.json');
    h.stdout.length = 0;
    h.stderr.length = 0;
    await h.run('task', 'move', 'welcome-to-shipbench', '--to=done');
    expect(h.stdout).toEqual([]);
    expect(h.stderr.at(-1)).toBe('Moved welcome-to-shipbench → done');
    expect(h.adapter.files.get('.shipbench/config.json')).toBe(configBefore);
    expect(
      JSON.parse(h.adapter.files.get('.shipbench/layout.json') ?? '{}'),
    ).not.toHaveProperty('done');
  });

  it('requires --to or a placement flag', async () => {
    const h = harness();
    await h.run('init');
    await expect(
      h.run('task', 'move', 'welcome-to-shipbench'),
    ).rejects.toMatchObject({ code: 'commander.error', exitCode: 1 });
    expect(h.stderr.join('\n')).toContain('Provide --to, a placement flag');
  });

  it('lists the placement flags in help', async () => {
    const h = harness();
    await expect(h.run('task', 'move', '--help')).rejects.toMatchObject({
      code: 'commander.helpDisplayed',
      exitCode: 0,
    });
    const help = h.stdout.join('\n');
    for (const flag of [
      '--top',
      '--bottom',
      '--before <slug>',
      '--after <slug>',
      '--position <n>',
    ]) {
      expect(help).toContain(flag);
    }
    expect(help).toContain('defaults to');
  });
});

describe('shipbench task move placement', () => {
  let h: Harness;

  // `created` desc is the fallback order, so the visible todo column starts as
  // one, two, three with an empty layout.json — every task an unmaterialized
  // leftover.
  beforeEach(async () => {
    h = harness();
    await h.run('init');
    h.adapter.files.delete('.shipbench/tasks/welcome-to-shipbench.md');
    await h.run('task', 'create', 'One', '--status=todo');
    await h.run('task', 'create', 'Two', '--status=todo');
    await h.run('task', 'create', 'Three', '--status=todo');
    await h.run('task', 'create', 'Other', '--status=in-progress');
    setTaskCreated(h, 'one', '2026-01-03T00:00:00.000Z');
    setTaskCreated(h, 'two', '2026-01-02T00:00:00.000Z');
    setTaskCreated(h, 'three', '2026-01-01T00:00:00.000Z');
    h.stdout.length = 0;
    h.stderr.length = 0;
  });

  async function columnOrder(status: string): Promise<string[]> {
    h.stdout.length = 0;
    await h.run('task', 'list', `--status=${status}`, '--json');
    const payload = JSON.parse(h.stdout.join('\n'));
    h.stdout.length = 0;
    return payload.tasks.map((task: { slug: string }) => task.slug);
  }

  it('starts from created desc order', async () => {
    expect(await columnOrder('todo')).toEqual(['one', 'two', 'three']);
  });

  it('--top places first and --bottom places last', async () => {
    await h.run('task', 'move', 'three', '--top');
    expect(await columnOrder('todo')).toEqual(['three', 'one', 'two']);

    await h.run('task', 'move', 'three', '--bottom');
    expect(await columnOrder('todo')).toEqual(['one', 'two', 'three']);
  });

  it('--before and --after resolve against unmaterialized leftovers', async () => {
    await h.run('task', 'move', 'three', '--before=two');
    expect(await columnOrder('todo')).toEqual(['one', 'three', 'two']);

    await h.run('task', 'move', 'one', '--after=two');
    expect(await columnOrder('todo')).toEqual(['three', 'two', 'one']);
  });

  it('--position takes a 0-based index and -1 appends', async () => {
    await h.run('task', 'move', 'one', '--position=1');
    expect(await columnOrder('todo')).toEqual(['two', 'one', 'three']);

    await h.run('task', 'move', 'two', '--position=-1');
    expect(await columnOrder('todo')).toEqual(['one', 'three', 'two']);
  });

  it('reorders in place without --to and without touching updated', async () => {
    const before = matter(
      h.adapter.files.get('.shipbench/tasks/three.md') ?? '',
    ).data;

    await h.run('task', 'move', 'three', '--top');
    expect(h.stdout).toEqual([]);
    expect(h.stderr).toEqual([
      'Reordered three in todo → position 0 of 3',
      'Wrote .shipbench/layout.json',
    ]);

    const after = matter(
      h.adapter.files.get('.shipbench/tasks/three.md') ?? '',
    ).data;
    expect(after.status).toBe('todo');
    expect(after.updated).toBe(before.updated);
    expect(await columnOrder('todo')).toEqual(['three', 'one', 'two']);
  });

  it('writes both status and layout on a cross-column move', async () => {
    await h.run('task', 'move', 'two', '--to=in-progress', '--top');
    expect(h.stdout).toEqual([]);
    expect(h.stderr).toEqual([
      'Moved two → in-progress at position 0 of 2',
      'Wrote .shipbench/layout.json',
    ]);

    expect(
      matter(h.adapter.files.get('.shipbench/tasks/two.md') ?? '').data.status,
    ).toBe('in-progress');
    expect(await columnOrder('in-progress')).toEqual(['two', 'other']);
    expect(await columnOrder('todo')).toEqual(['one', 'three']);
  });

  it('rejects placement into the done column', async () => {
    await expect(
      h.run('task', 'move', 'one', '--to=done', '--top'),
    ).rejects.toMatchObject({ code: 'commander.error', exitCode: 1 });
    expect(h.stderr.join('\n')).toContain('always sorted by last update');
    expect(
      matter(h.adapter.files.get('.shipbench/tasks/one.md') ?? '').data.status,
    ).toBe('todo');
  });

  it('rejects an unknown task', async () => {
    await expect(h.run('task', 'move', 'ghost', '--top')).rejects.toMatchObject(
      { code: 'commander.error', exitCode: 1 },
    );
    expect(h.stderr.join('\n')).toContain("Task 'ghost' not found.");
  });

  it('rejects an unknown anchor', async () => {
    await expect(
      h.run('task', 'move', 'one', '--before=ghost'),
    ).rejects.toMatchObject({ code: 'commander.error', exitCode: 1 });
    expect(h.stderr.join('\n')).toContain("Anchor task 'ghost' not found.");
  });

  it('rejects an archived anchor', async () => {
    await h.run('task', 'archive', 'three');
    h.stderr.length = 0;

    await expect(
      h.run('task', 'move', 'one', '--after=three'),
    ).rejects.toMatchObject({ code: 'commander.error', exitCode: 1 });
    expect(h.stderr.join('\n')).toContain(
      "Anchor task 'three' is archived and is not on the board.",
    );
  });

  it('rejects an anchor from another column', async () => {
    await expect(
      h.run('task', 'move', 'one', '--before=other'),
    ).rejects.toMatchObject({ code: 'commander.error', exitCode: 1 });
    expect(h.stderr.join('\n')).toContain(
      "Anchor task 'other' is in the 'in-progress' column, not 'todo'.",
    );
  });

  it('rejects a self anchor', async () => {
    await expect(
      h.run('task', 'move', 'one', '--after=one'),
    ).rejects.toMatchObject({ code: 'commander.error', exitCode: 1 });
    expect(h.stderr.join('\n')).toContain("Cannot place 'one' after itself.");
  });

  it('rejects two placement flags at once', async () => {
    await expect(
      h.run('task', 'move', 'one', '--top', '--bottom'),
    ).rejects.toThrow(/cannot be used with option/i);
  });

  it('rejects a position below -1', async () => {
    await expect(h.run('task', 'move', 'one', '--position=-2')).rejects.toThrow(
      /-1 or greater/i,
    );
  });
});
