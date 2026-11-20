import { loadConfig, reorderTask } from '@shipbench/core';
import matter from 'gray-matter';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  type Harness,
  harness,
  setTaskBody,
  setTaskCreated,
} from './testing.js';

describe('task files whose frontmatter does not parse', () => {
  // A hand edit that left two `depends_on` keys: the reported case.
  const BROKEN = [
    '---',
    'title: Hand edited',
    'status: todo',
    'depends_on: [a]',
    'depends_on: [b]',
    '---',
    '',
    'Body.',
    '',
  ].join('\n');
  const LINE =
    '[unreadable] .shipbench/tasks/hand-edited.md: Duplicated mapping key at line 5. (hand-edited)';

  async function project() {
    const h = harness();
    await h.run('init');
    h.adapter.files.set('.shipbench/tasks/hand-edited.md', BROKEN);
    h.stdout.length = 0;
    h.stderr.length = 0;
    return h;
  }

  it('lists the file on stdout beside the tasks, whatever the filters', async () => {
    const h = await project();

    await h.run('task', 'list');
    expect(h.stdout).toContain(LINE);
    expect(h.stdout.join('\n')).toContain('welcome-to-shipbench');

    // It has no status or dependencies, so no filter can rule it out.
    h.stdout.length = 0;
    await h.run('task', 'list', '--available', '--status', 'done');
    expect(h.stdout).toEqual([LINE]);
  });

  it('carries the file in list JSON, with its content under --include-body', async () => {
    const h = await project();

    await h.run('task', 'list', '--available', '--json');
    expect(JSON.parse(h.stdout.join('\n')).unreadable).toEqual([
      {
        slug: 'hand-edited',
        path: '.shipbench/tasks/hand-edited.md',
        reason: 'Duplicated mapping key at line 5.',
      },
    ]);

    h.stdout.length = 0;
    await h.run('task', 'list', '--json', '--include-body');
    expect(JSON.parse(h.stdout.join('\n')).unreadable).toEqual([
      expect.objectContaining({ slug: 'hand-edited', content: BROKEN }),
    ]);
  });

  it('reports an empty unreadable array when every file parses', async () => {
    const h = harness();
    await h.run('init');
    h.stdout.length = 0;

    await h.run('task', 'list', '--json');

    expect(JSON.parse(h.stdout.join('\n')).unreadable).toEqual([]);
  });

  it('reports the file from search, which cannot look inside it', async () => {
    const h = await project();

    await h.run('task', 'search', 'no-such-term');
    expect(h.stdout).toEqual(['No matches for "no-such-term".', LINE]);

    h.stdout.length = 0;
    await h.run('task', 'search', 'welcome', '--json');
    expect(JSON.parse(h.stdout.join('\n')).unreadable).toEqual([
      expect.objectContaining({ slug: 'hand-edited' }),
    ]);
  });

  it('exits zero from list, since the read itself succeeded', async () => {
    // Recorded on the task: non-zero would break scripts that tolerate
    // warnings today, and the file is now in the output they read.
    const h = await project();
    await expect(h.run('task', 'list', '--json')).resolves.toBeUndefined();
  });

  it('names the task and the file when task get cannot read it', async () => {
    const h = await project();

    await expect(h.run('task', 'get', 'hand-edited')).rejects.toThrow(
      'Cannot read task "hand-edited": the frontmatter in .shipbench/tasks/hand-edited.md does not parse. Duplicated mapping key at line 5. Fix the file to restore the task.',
    );
  });
});

describe('shipbench task get', () => {
  it('names the offending line when a task Updates section is unreadable', async () => {
    const h = harness();
    await h.run('init');
    const section = `## Task Updates

### 2026-07-24T20:00:00.000Z
Kept.

#### 2026-07-25T09:30:00.000Z
Wrong level.`;
    h.adapter.files.set(
      '.shipbench/tasks/broken.md',
      matter.stringify(`\nDescription.\n\n${section}\n`, {
        title: 'Broken',
        status: 'todo',
        created: '2026-01-01T00:00:00.000Z',
        updated: '2026-01-01T00:00:00.000Z',
      }),
    );

    h.stdout.length = 0;
    h.stderr.length = 0;
    await h.run('task', 'get', 'broken');

    expect(h.stderr.join('\n')).toContain(
      'saw "#### 2026-07-25T09:30:00.000Z"',
    );
    const payload = JSON.parse(h.stdout.join('\n'));
    expect(payload.body).toBe('Description.');
    expect(payload.comments).toEqual([]);
    expect(payload.unreadable_updates.text).toBe(section);
  });

  it('keeps an unreadable Updates section through a description rewrite', async () => {
    const h = harness();
    await h.run('init');
    const section = `## Task Updates

#### 2026-07-25T09:30:00.000Z
Wrong level.`;
    h.adapter.files.set(
      '.shipbench/tasks/broken.md',
      matter.stringify(`\nOld description.\n\n${section}\n`, {
        title: 'Broken',
        status: 'todo',
        created: '2026-01-01T00:00:00.000Z',
        updated: '2026-01-01T00:00:00.000Z',
      }),
    );

    await h.run('task', 'edit', 'broken', '--body', 'New description.');

    const written = matter(
      h.adapter.files.get('.shipbench/tasks/broken.md')!,
    ).content.trim();
    expect(written).toBe(`New description.\n\n${section}`);
  });

  it('returns one live task with nested frontmatter and body fidelity', async () => {
    const h = harness();
    await h.run('init');
    await h.run(
      'task',
      'create',
      'Inspect me',
      '--status=in-progress',
      '--priority=high',
      '--assignee=agent',
      '--tags=cli,query',
    );
    const path = '.shipbench/tasks/inspect-me.md';
    const parsed = matter(h.adapter.files.get(path)!);
    h.adapter.files.set(
      path,
      matter.stringify('\n# Retrieval\n\nKeep **all** of this.\n', parsed.data),
    );
    h.stdout.length = 0;

    await h.run('task', 'get', 'inspect-me');
    const payload = JSON.parse(h.stdout.join('\n'));

    expect(Object.keys(payload)).toEqual([
      'slug',
      'status',
      'frontmatter',
      'body',
      'comments',
    ]);
    expect(payload).toEqual({
      slug: 'inspect-me',
      status: 'in-progress',
      frontmatter: expect.objectContaining({
        title: 'Inspect me',
        status: 'in-progress',
        priority: 'high',
        assignee: 'agent',
        tags: ['cli', 'query'],
        created: expect.any(String),
        updated: expect.any(String),
      }),
      body: '# Retrieval\n\nKeep **all** of this.',
      comments: [],
    });
  });

  it('retrieves an archived task when --archived is passed', async () => {
    const h = harness();
    await h.run('init');
    await h.run('task', 'create', 'Archived record', '--status=done');
    const path = '.shipbench/tasks/archived-record.md';
    const parsed = matter(h.adapter.files.get(path)!);
    h.adapter.files.set(
      path,
      matter.stringify('\nArchived body\n', parsed.data),
    );
    await h.run('task', 'archive', 'archived-record');
    h.stdout.length = 0;

    await h.run('task', 'get', 'archived-record', '--archived');
    const archived = JSON.parse(h.stdout.join('\n'));

    expect(archived).toEqual(
      expect.objectContaining({
        slug: 'archived-record',
        status: 'done',
        frontmatter: expect.objectContaining({ title: 'Archived record' }),
        body: 'Archived body',
      }),
    );
  });

  it('suggests --archived when the live slug has been archived', async () => {
    const h = harness();
    await h.run('init');
    await h.run('task', 'create', 'Archived record', '--status=done');
    await h.run('task', 'archive', 'archived-record');
    h.stdout.length = 0;

    await expect(h.run('task', 'get', 'archived-record')).rejects.toMatchObject(
      {
        code: 'commander.error',
        exitCode: 1,
      },
    );
    expect(h.stdout).toEqual([]);
    expect(h.stderr.join('\n')).toContain(
      "Task 'archived-record' is archived. Pass --archived to retrieve.",
    );
  });

  it('fails with a non-zero exit code and stderr message when missing', async () => {
    const h = harness();
    await h.run('init');
    h.stdout.length = 0;

    await expect(h.run('task', 'get', 'missing')).rejects.toMatchObject({
      code: 'commander.error',
      exitCode: 1,
    });
    expect(h.stdout).toEqual([]);
    expect(h.stderr.join('\n')).toContain("Task 'missing' not found.");
  });

  it('resolves the show alias', async () => {
    const h = harness();
    await h.run('init');
    await h.run('task', 'create', 'Shown task', '--status=todo');
    h.stdout.length = 0;

    await h.run('task', 'show', 'shown-task');

    expect(JSON.parse(h.stdout.join('\n'))).toEqual(
      expect.objectContaining({ slug: 'shown-task', status: 'todo' }),
    );
  });

  it('is documented in task help', async () => {
    const h = harness();

    await expect(h.run('task', '--help')).rejects.toMatchObject({
      code: 'commander.helpDisplayed',
      exitCode: 0,
    });
    expect(h.stdout.join('\n')).toMatch(
      /get\|show \[options\] <slug>\s+Retrieve one task as JSON/,
    );
  });
});

describe('shipbench task list', () => {
  let h: Harness;
  beforeEach(async () => {
    h = harness();
    await h.run('init');
    await h.run('task', 'create', 'One', '--status=todo');
    await h.run('task', 'create', 'Two', '--status=in-progress');
    await h.run('task', 'create', 'Three', '--status=done', '--priority=high');
    h.stdout.length = 0;
  });

  it('lists all tasks', async () => {
    await h.run('task', 'list');
    expect(h.stdout.length).toBeGreaterThanOrEqual(3);
  });

  it('lists tasks in fallback order and warns about malformed layout metadata', async () => {
    h.adapter.files.set('.shipbench/layout.json', '{"todo":');
    h.stderr.length = 0;

    await h.run('task', 'list');

    expect(h.stdout.length).toBeGreaterThanOrEqual(3);
    expect(h.stderr).toEqual([
      expect.stringMatching(
        /Warning: \.shipbench\/layout\.json:.*fallback order/i,
      ),
    ]);
  });

  it('keeps task read warnings on stderr in text mode and in-band in JSON', async () => {
    h.adapter.files.set(
      '.shipbench/tasks/warning.md',
      `---
title: Warning
status: unknown
created: 2026-01-01T00:00:00.000Z
updated: 2026-01-01T00:00:00.000Z
---
`,
    );
    h.stdout.length = 0;
    h.stderr.length = 0;

    await h.run('task', 'list');

    expect(h.stdout.join('\n')).not.toContain('Warnings:');
    expect(h.stderr.join('\n')).toMatch(/Warnings:.*warning.*unknown status/is);

    h.stdout.length = 0;
    h.stderr.length = 0;
    await h.run('task', 'list', '--json');
    const payload = JSON.parse(h.stdout.join('\n'));
    expect(payload.warnings).toEqual([
      expect.objectContaining({ slug: 'warning' }),
    ]);
    expect(h.stderr).toEqual([]);
  });

  it('filters by status', async () => {
    await h.run('task', 'list', '--status=in-progress');
    const taskLines = h.stdout.filter(l => l.startsWith('['));
    expect(taskLines).toHaveLength(1);
    expect(taskLines[0]).toContain('Two');
  });

  it('filters by priority', async () => {
    await h.run('task', 'list', '--priority=high');
    const taskLines = h.stdout.filter(l => l.startsWith('['));
    expect(taskLines).toHaveLength(1);
    expect(taskLines[0]).toContain('Three');
  });

  it('matches any of a comma-separated --status list', async () => {
    await h.run('task', 'list', '--status=todo,in-progress');
    const titles = h.stdout.filter(l => l.startsWith('[')).join('\n');
    expect(titles).toContain('One');
    expect(titles).toContain('Two');
    expect(titles).not.toContain('Three');
  });

  it('errors on an unknown --status value instead of returning nothing', async () => {
    await expect(
      h.run('task', 'list', '--status=todo,bogus'),
    ).rejects.toMatchObject({ code: 'commander.error' });
    expect(h.stderr.join('\n')).toMatch(
      /Unknown status "bogus"\. Valid: todo, in-progress, done/,
    );
  });

  it('errors on an unknown --priority value', async () => {
    await expect(
      h.run('task', 'list', '--priority=urgent'),
    ).rejects.toMatchObject({ code: 'commander.error' });
    expect(h.stderr.join('\n')).toMatch(/Unknown priority "urgent"/);
  });

  it('matches any of a repeated --assignee list', async () => {
    await h.run('task', 'create', 'Mine', '--assignee=greg');
    await h.run('task', 'create', 'Theirs', '--assignee=claude');
    h.stdout.length = 0;

    await h.run('task', 'list', '--assignee=greg', '--assignee=claude');
    const titles = h.stdout.filter(l => l.startsWith('[')).join('\n');
    expect(titles).toContain('Mine');
    expect(titles).toContain('Theirs');
  });

  it('filters by exact tag membership, case-insensitively', async () => {
    await h.run('task', 'create', 'Frontend', '--tags=UI,web');
    await h.run('task', 'create', 'Backend', '--tags=api');
    await h.run('task', 'create', 'Full stack', '--tags=ui,api');
    h.stdout.length = 0;

    await h.run('task', 'list', '--tag=Ui');
    const matchingLines = h.stdout.filter(l => l.startsWith('['));
    expect(matchingLines).toHaveLength(2);
    expect(matchingLines.join('\n')).toContain('Frontend');
    expect(matchingLines.join('\n')).toContain('Full stack');

    h.stdout.length = 0;
    await h.run('task', 'list', '--tag=user-interface');
    expect(h.stdout.filter(l => l.startsWith('['))).toEqual([]);
  });

  it('combines repeated or comma-separated --tag filters with AND semantics and --status', async () => {
    await h.run(
      'task',
      'create',
      'Todo match',
      '--status=todo',
      '--tags=ui,api',
    );
    await h.run(
      'task',
      'create',
      'Wrong status',
      '--status=in-progress',
      '--tags=ui,api',
    );
    await h.run('task', 'create', 'Missing tag', '--tags=ui');
    h.stdout.length = 0;

    await h.run('task', 'list', '--tag=UI', '--tag=Api', '--status=todo');

    expect(h.stdout.filter(l => l.startsWith('['))).toEqual([
      '[todo] Todo match (todo-match)',
    ]);

    h.stdout.length = 0;
    await h.run('task', 'list', '--tag=UI,Api', '--status=todo');
    expect(h.stdout.filter(l => l.startsWith('['))).toEqual([
      '[todo] Todo match (todo-match)',
    ]);
  });

  it('--json emits every task with a depends_on array', async () => {
    await h.run('task', 'create', 'Four', '--depends-on=one,two');
    h.stdout.length = 0;

    await h.run('task', 'list', '--json');
    const payload = JSON.parse(h.stdout.join('\n'));

    const four = payload.tasks.find((t: { slug: string }) => t.slug === 'four');
    expect(four.depends_on).toEqual(['one', 'two']);

    const one = payload.tasks.find((t: { slug: string }) => t.slug === 'one');
    expect(one.depends_on).toEqual([]);
    expect(one.position).toBeTypeOf('number');
    expect(one).not.toHaveProperty('body');
    expect(payload.warnings).toEqual([]);
  });

  it('emits configured columns in board order with column-relative positions', async () => {
    h.adapter.files.delete('.shipbench/tasks/welcome-to-shipbench.md');
    await h.run('task', 'create', 'Newest todo', '--status=todo');
    setTaskCreated(h, 'one', '2026-01-01T00:00:00.000Z');
    setTaskCreated(h, 'newest-todo', '2026-01-03T00:00:00.000Z');
    h.adapter.files.set(
      '.shipbench/layout.json',
      JSON.stringify({ todo: ['one'] }),
    );
    h.stdout.length = 0;

    await h.run('task', 'list', '--json');
    const payload = JSON.parse(h.stdout.join('\n'));

    expect(payload.tasks.map((task: { slug: string }) => task.slug)).toEqual([
      'one',
      'newest-todo',
      'two',
      'three',
    ]);
    expect(
      payload.tasks.map((task: { position: number }) => task.position),
    ).toEqual([0, 1, 0, 0]);
  });

  it('--status preserves within-column board order and positions', async () => {
    h.adapter.files.delete('.shipbench/tasks/welcome-to-shipbench.md');
    await h.run('task', 'create', 'Newest todo', '--status=todo');
    h.adapter.files.set(
      '.shipbench/layout.json',
      JSON.stringify({ todo: ['one', 'newest-todo'] }),
    );
    h.stdout.length = 0;

    await h.run('task', 'list', '--status=todo', '--json');
    const payload = JSON.parse(h.stdout.join('\n'));

    expect(payload.tasks.map((task: { slug: string }) => task.slug)).toEqual([
      'one',
      'newest-todo',
    ]);
    expect(
      payload.tasks.map((task: { position: number }) => task.position),
    ).toEqual([0, 1]);
  });

  it('reflects board order after a positioned move', async () => {
    h.adapter.files.delete('.shipbench/tasks/welcome-to-shipbench.md');
    const config = await loadConfig(h.adapter);
    await reorderTask(h.adapter, config, 'one', 'in-progress', 0);
    h.stdout.length = 0;

    await h.run('task', 'list', '--status=in-progress', '--json');
    const payload = JSON.parse(h.stdout.join('\n'));

    expect(payload.tasks.map((task: { slug: string }) => task.slug)).toEqual([
      'one',
      'two',
    ]);
    expect(
      payload.tasks.map((task: { position: number }) => task.position),
    ).toEqual([0, 1]);
  });

  it('--include-body preserves Markdown bodies in JSON output only', async () => {
    const body = 'First paragraph.\n\n- one\n- **two**';
    setTaskBody(h, 'one', body);

    await h.run('task', 'list', '--json', '--include-body', '--tag=missing');
    let payload = JSON.parse(h.stdout.join('\n'));
    expect(payload.tasks).toEqual([]);

    h.stdout.length = 0;
    await h.run('task', 'list', '--json', '--include-body', '--status=todo');
    payload = JSON.parse(h.stdout.join('\n'));
    const one = payload.tasks.find((t: { slug: string }) => t.slug === 'one');
    expect(one.body).toBe(body);
    expect(one.comments).toEqual([]);

    h.stdout.length = 0;
    await h.run('task', 'list', '--status=todo');
    const textOutput = [...h.stdout];

    h.stdout.length = 0;
    await h.run('task', 'list', '--include-body', '--status=todo');
    expect(h.stdout).toEqual(textOutput);
  });

  it('applies --limit after ordinary list filters', async () => {
    await h.run('task', 'list', '--status=todo', '--limit=1', '--json');
    const payload = JSON.parse(h.stdout.join('\n'));

    expect(payload.tasks).toHaveLength(1);
    expect(payload.tasks[0].status).toBe('todo');
  });

  it('rejects a negative --limit', async () => {
    await expect(h.run('task', 'list', '--limit=-1')).rejects.toThrow(
      /non-negative integer/i,
    );
  });
});

describe('shipbench task list availability filters', () => {
  async function availabilityHarness(): Promise<Harness> {
    const h = harness();
    await h.run('init');
    h.adapter.files.delete('.shipbench/tasks/welcome-to-shipbench.md');

    await h.run('task', 'create', 'Done prerequisite', '--status=done');
    await h.run('task', 'create', 'Archived prerequisite', '--status=done');
    await h.run('task', 'create', 'Live prerequisite', '--status=in-progress');
    await h.run(
      'task',
      'create',
      'Done candidate',
      '--priority=high',
      '--depends-on=done-prerequisite',
    );
    await h.run(
      'task',
      'create',
      'Archive candidate',
      '--priority=high',
      '--depends-on=archived-prerequisite',
    );
    await h.run('task', 'create', 'Standalone candidate', '--priority=medium');
    await h.run(
      'task',
      'create',
      'Mixed blocked',
      '--priority=high',
      '--depends-on=done-prerequisite,live-prerequisite',
    );
    await h.run(
      'task',
      'create',
      'Live blocked',
      '--priority=low',
      '--depends-on=live-prerequisite',
    );
    await h.run('task', 'create', 'Active ready', '--status=in-progress');
    await h.run('task', 'archive', 'archived-prerequisite');

    setTaskCreated(h, 'archive-candidate', '2026-01-01T00:00:00.000Z');
    setTaskCreated(h, 'done-candidate', '2026-01-02T00:00:00.000Z');
    setTaskCreated(h, 'standalone-candidate', '2026-01-03T00:00:00.000Z');
    setTaskCreated(h, 'mixed-blocked', '2026-01-04T00:00:00.000Z');
    setTaskCreated(h, 'live-blocked', '2026-01-05T00:00:00.000Z');
    setTaskCreated(h, 'live-prerequisite', '2026-01-06T00:00:00.000Z');
    setTaskCreated(h, 'active-ready', '2026-01-07T00:00:00.000Z');
    h.stdout.length = 0;
    return h;
  }

  it('--available lists default-column tasks whose dependencies are satisfied', async () => {
    const h = await availabilityHarness();

    await h.run('task', 'list', '--available');

    expect(h.stdout.filter(line => line.startsWith('['))).toEqual([
      '[todo] Archive candidate (archive-candidate)',
      '[todo] Done candidate (done-candidate)',
      '[todo] Standalone candidate (standalone-candidate)',
    ]);
  });

  it('--blocked lists the inverse within the actionable column', async () => {
    const h = await availabilityHarness();

    await h.run('task', 'list', '--blocked');

    expect(h.stdout.filter(line => line.startsWith('['))).toEqual([
      '[todo] Mixed blocked (mixed-blocked)',
      '[todo] Live blocked (live-blocked)',
    ]);
  });

  it('does not warn when a plain list resolves a dependency in the archive', async () => {
    const h = await availabilityHarness();

    await h.run('task', 'list', '--json');
    const payload = JSON.parse(h.stdout.join('\n'));

    expect(payload.warnings).toEqual([]);
  });

  it('treats a malformed archived prerequisite as satisfied by file slug', async () => {
    const h = await availabilityHarness();
    h.adapter.files.set(
      '.shipbench/tasks/archive/archived-prerequisite.md',
      '---\ntitle: [unclosed\n---\n\nbody\n',
    );

    await h.run('task', 'list', '--available');

    expect(h.stdout).toContain('[todo] Archive candidate (archive-candidate)');
  });

  it('--status overrides the actionable column', async () => {
    const h = await availabilityHarness();

    await h.run('task', 'list', '--available', '--status=in-progress');

    expect(h.stdout.filter(line => line.startsWith('['))).toEqual([
      '[in-progress] Live prerequisite (live-prerequisite)',
      '[in-progress] Active ready (active-ready)',
    ]);
  });

  it('applies --limit after availability sorting and preserves JSON shape', async () => {
    const h = await availabilityHarness();

    await h.run('task', 'list', '--available', '--limit=2', '--json');
    const payload = JSON.parse(h.stdout.join('\n'));

    expect(
      payload.tasks.map((candidate: { slug: string }) => candidate.slug),
    ).toEqual(['archive-candidate', 'done-candidate']);
    expect(payload.tasks[0]).toEqual(
      expect.objectContaining({
        slug: 'archive-candidate',
        status: 'todo',
        priority: 'high',
        depends_on: ['archived-prerequisite'],
        position: 1,
      }),
    );
    expect(payload.tasks[1].position).toBe(0);
    expect(payload.warnings).toEqual([]);
  });

  it('combines --tag with --available', async () => {
    const h = await availabilityHarness();
    const taggedPaths = [
      '.shipbench/tasks/archive-candidate.md',
      '.shipbench/tasks/mixed-blocked.md',
    ];
    for (const path of taggedPaths) {
      const raw = h.adapter.files.get(path);
      expect(raw).toBeDefined();
      const parsed = matter(raw!);
      parsed.data.tags = ['Agent'];
      h.adapter.files.set(path, matter.stringify(parsed.content, parsed.data));
    }

    await h.run('task', 'list', '--available', '--tag=agent');

    expect(h.stdout.filter(line => line.startsWith('['))).toEqual([
      '[todo] Archive candidate (archive-candidate)',
    ]);
  });

  it('rejects --available together with --blocked', async () => {
    const h = harness();

    await expect(
      h.run('task', 'list', '--available', '--blocked'),
    ).rejects.toThrow(/cannot be used with option/i);
  });

  it('rejects --archived together with an availability filter', async () => {
    const h = harness();

    await expect(
      h.run('task', 'list', '--archived', '--available'),
    ).rejects.toThrow(
      '--available and --blocked cannot be used with --archived.',
    );
  });

  it('documents the availability flags in command help', async () => {
    const h = harness();

    await expect(h.run('task', 'list', '--help')).rejects.toMatchObject({
      code: 'commander.helpDisplayed',
      exitCode: 0,
    });
    expect(h.stdout.join('\n')).toMatch(
      /--tag <tag>[\s\S]*--available[\s\S]*--blocked[\s\S]*--limit <n>[\s\S]*--include-body/,
    );
    expect(h.stdout.join('\n')).toContain(
      'List live tasks in board order, optionally filtered',
    );
  });
});

describe('--exclude-tag on task list and search', () => {
  let h: Harness;
  beforeEach(async () => {
    h = harness();
    await h.run('init');
    h.adapter.files.delete('.shipbench/tasks/welcome-to-shipbench.md');
    await h.run('task', 'create', 'Write plan', '--tags=Plan,docs');
    await h.run('task', 'create', 'Write docs', '--tags=docs');
    await h.run('task', 'create', 'Run spike', '--tags=spike');
    await h.run('task', 'create', 'Ship api', '--depends-on=run-spike');
    await h.run('task', 'create', 'Fix bug');
    // Availability ranks by age, so pin it: `write-plan` ranks first.
    for (const [index, slug] of [
      'write-plan',
      'write-docs',
      'run-spike',
      'ship-api',
      'fix-bug',
    ].entries()) {
      setTaskCreated(h, slug, `2026-01-0${index + 1}T00:00:00.000Z`);
    }
    h.stdout.length = 0;
    h.stderr.length = 0;
  });

  const listed = async (...args: string[]) => {
    h.stdout.length = 0;
    await h.run('task', 'list', ...args, '--json');
    return JSON.parse(h.stdout.join('\n')).tasks.map(
      (task: { slug: string }) => task.slug,
    );
  };

  it('drops a task carrying any excluded tag, ignoring case', async () => {
    expect(await listed('--exclude-tag=plan,SPIKE')).toEqual([
      'write-docs',
      'ship-api',
      'fix-bug',
    ]);
    expect(
      await listed('--exclude-tag', 'plan', '--exclude-tag', 'spike'),
    ).toEqual(['write-docs', 'ship-api', 'fix-bug']);
  });

  it('combines with --tag, and an overlap is an empty result, not an error', async () => {
    expect(await listed('--tag=docs', '--exclude-tag=plan')).toEqual([
      'write-docs',
    ]);
    expect(await listed('--tag=docs', '--exclude-tag=docs')).toEqual([]);
  });

  it('combines with --available and applies before --limit', async () => {
    expect(await listed('--available', '--exclude-tag=plan')).toEqual([
      'write-docs',
      'run-spike',
      'fix-bug',
    ]);
    expect(
      await listed('--available', '--exclude-tag=plan', '--limit=1'),
    ).toEqual(['write-docs']);
  });

  it('applies to archived tasks and to text output', async () => {
    await h.run('task', 'archive', 'write-plan');
    expect(await listed('--archived', '--exclude-tag=plan')).toEqual([]);

    h.stdout.length = 0;
    await h.run('task', 'list', '--exclude-tag=docs,spike');
    expect(h.stdout.filter(line => line.startsWith('['))).toEqual([
      '[todo] Ship api (ship-api)',
      '[todo] Fix bug (fix-bug)',
    ]);
  });

  it('filters task search the same way', async () => {
    await h.run('task', 'search', 'write', '--exclude-tag=plan', '--json');
    expect(
      JSON.parse(h.stdout.join('\n')).matches.map(
        (match: { slug: string }) => match.slug,
      ),
    ).toEqual(['write-docs']);
  });
});

describe('shipbench task search', () => {
  async function searchHarness(): Promise<Harness> {
    const h = harness();
    await h.run('init');
    h.adapter.files.delete('.shipbench/tasks/welcome-to-shipbench.md');
    await h.run('task', 'create', 'Needle in title');
    await h.run('task', 'create', 'Tagged match', '--tags=CLI-Needle,query');
    await h.run('task', 'create', 'Body match');
    setTaskBody(
      h,
      'body-match',
      'First paragraph.\n\nThe NEEDLE is in this Markdown body.',
    );
    h.stdout.length = 0;
    return h;
  }

  it('emits structured JSON matches for titles, tags, and bodies', async () => {
    const h = await searchHarness();

    await h.run('task', 'search', 'needle', '--json');
    const payload = JSON.parse(h.stdout.join('\n'));

    expect(payload.warnings).toEqual([]);
    expect(payload.matches).toEqual([
      {
        slug: 'needle-in-title',
        title: 'Needle in title',
        status: 'todo',
        location: 'live',
        matched_fields: ['title'],
        related_tasks: [],
      },
      {
        slug: 'tagged-match',
        title: 'Tagged match',
        status: 'todo',
        location: 'live',
        matched_fields: ['tags'],
        related_tasks: [],
      },
      {
        slug: 'body-match',
        title: 'Body match',
        status: 'todo',
        location: 'live',
        matched_fields: ['body'],
        related_tasks: [],
        snippet: 'First paragraph. The NEEDLE is in this Markdown body.',
      },
    ]);
  });

  it('finds rationale that lives only in a Task Update, with its index and timestamp', async () => {
    const h = await searchHarness();
    await h.run(
      'task',
      'comment',
      'needle-in-title',
      'Chose the polling approach because webhooks need a public callback.',
    );
    h.stdout.length = 0;

    await h.run('task', 'search', 'polling webhooks', '--json');
    const payload = JSON.parse(h.stdout.join('\n'));

    expect(payload.matches).toHaveLength(1);
    const [match] = payload.matches;
    expect(match.slug).toBe('needle-in-title');
    expect(match.matched_fields).toEqual(['updates']);
    expect(match.update_matches).toHaveLength(1);
    expect(match.update_matches[0].index).toBe(0);
    expect(typeof match.update_matches[0].timestamp).toBe('string');
    expect(match.update_matches[0].snippet).toContain('polling approach');

    h.stdout.length = 0;
    await h.run('task', 'search', 'polling webhooks');
    expect(h.stdout.join('\n')).toMatch(
      /Needle in title \(needle-in-title\) \[live · todo\] \[updates\]/,
    );
    expect(h.stdout.join('\n')).toMatch(
      /↳ update 0 \(.+\): .*polling approach/,
    );
  });

  it('supports --include-body, --limit, and JSON empty results', async () => {
    const h = await searchHarness();

    await h.run('task', 'search', 'NEEDLE', '--json', '--include-body');
    let payload = JSON.parse(h.stdout.join('\n'));
    expect(payload.matches[2]).toHaveProperty(
      'body',
      'First paragraph.\n\nThe NEEDLE is in this Markdown body.',
    );
    expect(payload.matches[2]).toHaveProperty('comments', []);

    h.stdout.length = 0;
    await h.run('task', 'search', 'NEEDLE', '--json', '--limit=2');
    payload = JSON.parse(h.stdout.join('\n'));
    expect(payload.matches).toHaveLength(2);
    expect(payload.total_matches).toBe(3);

    h.stdout.length = 0;
    await h.run('task', 'search', 'absent', '--json');
    payload = JSON.parse(h.stdout.join('\n'));
    expect(payload.matches).toEqual([]);
    expect(payload.total_matches).toBe(0);
  });

  it('signals omitted matches in text output when --limit truncates', async () => {
    const h = await searchHarness();

    await h.run('task', 'search', 'NEEDLE', '--limit=2');

    expect(h.stdout.at(-1)).toBe('… 1 of 3 matches not shown (raise --limit)');
  });

  it('describes empty text results', async () => {
    const h = await searchHarness();

    await h.run('task', 'search', 'absent terms');

    expect(h.stdout).toEqual(['No matches for "absent terms".']);
  });

  it('suppresses the archived header when --limit=0 hides matches', async () => {
    const h = harness();
    await h.run('init');
    h.adapter.files.delete('.shipbench/tasks/welcome-to-shipbench.md');
    await h.run('task', 'create', 'Archived needle');
    await h.run('task', 'archive', 'archived-needle');
    h.stdout.length = 0;

    await h.run('task', 'search', 'needle', '--archived', '--limit=0');

    expect(h.stdout).toEqual(['… 1 of 1 match not shown (raise --limit)']);
  });

  it('searches live tasks by default, archived tasks with --archived, and both with --all', async () => {
    const h = harness();
    await h.run('init');
    h.adapter.files.delete('.shipbench/tasks/welcome-to-shipbench.md');
    await h.run('task', 'create', 'Live scope marker');
    await h.run('task', 'create', 'Archived scope marker');
    await h.run('task', 'archive', 'archived-scope-marker');
    h.stdout.length = 0;

    await h.run('task', 'search', 'scope marker', '--json');
    let payload = JSON.parse(h.stdout.join('\n'));
    expect(
      payload.matches.map((match: { slug: string }) => match.slug),
    ).toEqual(['live-scope-marker']);

    h.stdout.length = 0;
    await h.run('task', 'search', 'scope marker', '--archived', '--json');
    payload = JSON.parse(h.stdout.join('\n'));
    expect(
      payload.matches.map((match: { slug: string }) => match.slug),
    ).toEqual(['archived-scope-marker']);

    h.stdout.length = 0;
    await h.run('task', 'search', 'scope marker', '--all', '--json');
    payload = JSON.parse(h.stdout.join('\n'));
    expect(
      payload.matches.map((match: { slug: string }) => match.slug).sort(),
    ).toEqual(['archived-scope-marker', 'live-scope-marker']);
  });

  it('rejects invalid option combinations and negative limits', async () => {
    const h = harness();

    await expect(
      h.run('task', 'search', 'query', '--archived', '--all'),
    ).rejects.toThrow(/cannot be used with option/i);
    await expect(
      h.run('task', 'search', 'query', '--limit=-1'),
    ).rejects.toThrow(/non-negative integer/i);
  });

  it('documents the command and its options in help', async () => {
    const taskHelp = harness();
    await expect(taskHelp.run('task', '--help')).rejects.toMatchObject({
      code: 'commander.helpDisplayed',
      exitCode: 0,
    });
    expect(taskHelp.stdout.join('\n')).toMatch(
      /search \[options\] <query>\s+Search task titles, tags, Markdown[\s\S]+?descriptions, and[\s\S]+?Task Updates/,
    );

    const searchHelp = harness();
    await expect(
      searchHelp.run('task', 'search', '--help'),
    ).rejects.toMatchObject({
      code: 'commander.helpDisplayed',
      exitCode: 0,
    });
    expect(searchHelp.stdout.join('\n')).toMatch(
      /--status <statuses>[\s\S]*--tag <tag>[\s\S]*--available[\s\S]*--blocked[\s\S]*--whole-word[\s\S]*--archived[\s\S]*--all[\s\S]*--limit <n>[\s\S]*--json[\s\S]*--include-body/,
    );
  });

  it('restricts matches to word boundaries with --whole-word', async () => {
    const h = await searchHarness();
    await h.run('task', 'create', 'Precision work');
    setTaskBody(
      h,
      'precision-work',
      'A specific, explicit decision recorded here.',
    );
    h.stdout.length = 0;

    await h.run('task', 'search', 'ci', '--json');
    const substringSlugs = JSON.parse(h.stdout.join('\n')).matches.map(
      (match: { slug: string }) => match.slug,
    );
    expect(substringSlugs).toContain('precision-work');

    h.stdout.length = 0;
    await h.run('task', 'search', 'ci', '--whole-word', '--json');
    const wholeWordSlugs = JSON.parse(h.stdout.join('\n')).matches.map(
      (match: { slug: string }) => match.slug,
    );
    expect(wholeWordSlugs).not.toContain('precision-work');
  });

  it('treats a quoted run in the query as one contiguous phrase', async () => {
    const h = await searchHarness();
    await h.run('task', 'create', 'Contiguous run');
    setTaskBody(h, 'contiguous-run', 'Implement the token exchange handshake.');
    await h.run('task', 'create', 'Scattered run');
    setTaskBody(
      h,
      'scattered-run',
      'The token is stored; the exchange log is not.',
    );
    h.stdout.length = 0;

    await h.run('task', 'search', '"token exchange"', '--json');
    const slugs = JSON.parse(h.stdout.join('\n')).matches.map(
      (match: { slug: string }) => match.slug,
    );
    expect(slugs).toEqual(['contiguous-run']);
  });
});

describe('shipbench task search metadata and availability filters', () => {
  async function filterHarness(): Promise<Harness> {
    const h = harness();
    await h.run('init');
    h.adapter.files.delete('.shipbench/tasks/welcome-to-shipbench.md');

    await h.run('task', 'create', 'Done needle prerequisite', '--status=done');
    await h.run(
      'task',
      'create',
      'Live needle prerequisite',
      '--status=in-progress',
    );
    await h.run(
      'task',
      'create',
      'Ready needle work',
      '--priority=high',
      '--assignee=claude',
      '--tags=search,backend',
      '--depends-on=done-needle-prerequisite',
    );
    await h.run(
      'task',
      'create',
      'Blocked needle work',
      '--priority=low',
      '--assignee=human',
      '--tags=search',
      '--depends-on=live-needle-prerequisite',
    );
    await h.run('task', 'create', 'Standalone needle work', '--tags=docs');
    await h.run('task', 'create', 'In progress needle', '--status=in-progress');
    setTaskBody(h, 'in-progress-needle', 'The needle is already being pulled.');
    h.stdout.length = 0;
    return h;
  }

  it('filters search results by status, assignee, priority, and tag', async () => {
    const h = await filterHarness();

    await h.run('task', 'search', 'needle', '--tag=search', '--json');
    let payload = JSON.parse(h.stdout.join('\n'));
    expect(
      payload.matches.map((match: { slug: string }) => match.slug).sort(),
    ).toEqual(['blocked-needle-work', 'ready-needle-work']);

    h.stdout.length = 0;
    await h.run(
      'task',
      'search',
      'needle',
      '--assignee=claude',
      '--priority=high',
      '--json',
    );
    payload = JSON.parse(h.stdout.join('\n'));
    expect(
      payload.matches.map((match: { slug: string }) => match.slug),
    ).toEqual(['ready-needle-work']);

    h.stdout.length = 0;
    await h.run('task', 'search', 'needle', '--status=in-progress', '--json');
    payload = JSON.parse(h.stdout.join('\n'));
    expect(
      payload.matches.map((match: { slug: string }) => match.slug).sort(),
    ).toEqual(['in-progress-needle', 'live-needle-prerequisite']);
  });

  it('accepts a multi-value --status and errors on an unknown one', async () => {
    const h = await filterHarness();

    await h.run(
      'task',
      'search',
      'needle',
      '--status=todo,in-progress',
      '--json',
    );
    const payload = JSON.parse(h.stdout.join('\n'));
    const statuses = new Set(
      payload.matches.map((match: { status: string }) => match.status),
    );
    expect([...statuses].sort()).toEqual(['in-progress', 'todo']);

    await expect(
      h.run('task', 'search', 'needle', '--status=todo,bogus'),
    ).rejects.toMatchObject({ code: 'commander.error' });
    expect(h.stderr.join('\n')).toMatch(/Unknown status "bogus"/);
  });

  it('narrows to dependency-ready work with --available', async () => {
    const h = await filterHarness();

    await h.run('task', 'search', 'needle', '--available', '--json');
    const payload = JSON.parse(h.stdout.join('\n'));

    expect(
      payload.matches.map((match: { slug: string }) => match.slug).sort(),
    ).toEqual(['ready-needle-work', 'standalone-needle-work']);
  });

  it('narrows to blocked work with --blocked', async () => {
    const h = await filterHarness();

    await h.run('task', 'search', 'needle', '--blocked', '--json');
    const payload = JSON.parse(h.stdout.join('\n'));

    expect(
      payload.matches.map((match: { slug: string }) => match.slug),
    ).toEqual(['blocked-needle-work']);
  });

  it('counts an archived dependency as satisfied for --available', async () => {
    const h = await filterHarness();
    await h.run('task', 'archive', 'done-needle-prerequisite');
    h.stdout.length = 0;

    await h.run('task', 'search', 'needle', '--available', '--json');
    const payload = JSON.parse(h.stdout.join('\n'));

    expect(
      payload.matches.map((match: { slug: string }) => match.slug),
    ).toContain('ready-needle-work');
  });

  it('rejects an availability filter combined with --archived or --all', async () => {
    const h = harness();

    await expect(
      h.run('task', 'search', 'needle', '--available', '--archived'),
    ).rejects.toThrow(
      '--available and --blocked cannot be used with --archived or --all.',
    );
    await expect(
      h.run('task', 'search', 'needle', '--blocked', '--all'),
    ).rejects.toThrow(
      '--available and --blocked cannot be used with --archived or --all.',
    );
  });
});

describe('shipbench task graph', () => {
  async function graphHarness(isInteractive = false): Promise<Harness> {
    const h = harness(undefined, { isInteractive });
    await h.run('init');
    h.adapter.files.delete('.shipbench/tasks/welcome-to-shipbench.md');
    await h.run('task', 'create', 'Foundation', '--status=done');
    await h.run(
      'task',
      'create',
      'API',
      '--status=in-progress',
      '--depends-on=foundation',
    );
    await h.run('task', 'create', 'Standalone');
    await h.run('task', 'create', 'Missing target');
    await h.run(
      'task',
      'create',
      'Dangling consumer',
      '--depends-on=missing-target',
    );
    await h.run('task', 'delete', 'missing-target');
    await h.run('task', 'create', 'Archived foundation', '--status=done');
    await h.run(
      'task',
      'create',
      'Archive consumer',
      '--depends-on=archived-foundation',
    );
    await h.run('task', 'archive', 'archived-foundation');
    h.stdout.length = 0;
    return h;
  }

  it('emits JSON adjacency when piped, including reverse and missing edges', async () => {
    const h = await graphHarness();

    await h.run('task', 'graph');
    const graph = JSON.parse(h.stdout.join('\n'));

    expect(graph.api).toEqual({
      status: 'in-progress',
      depends_on: ['foundation'],
      blocks: [],
    });
    expect(graph.foundation).toEqual({
      status: 'done',
      depends_on: [],
      blocks: ['api'],
    });
    expect(graph.standalone).toEqual({
      status: 'todo',
      depends_on: [],
      blocks: [],
    });
    expect(graph['missing-target']).toEqual({
      status: 'missing',
      depends_on: [],
      blocks: ['dangling-consumer'],
    });
    expect(graph['archived-foundation']).toEqual({
      status: 'missing',
      depends_on: [],
      blocks: ['archive-consumer'],
    });
  });

  it('--archived includes archived nodes with archived status', async () => {
    const h = await graphHarness();

    await h.run('task', 'graph', '--archived', '--json');
    const graph = JSON.parse(h.stdout.join('\n'));

    expect(graph['archived-foundation']).toEqual({
      status: 'archived',
      depends_on: [],
      blocks: ['archive-consumer'],
    });
  });

  it('--archived identifies a malformed archived prerequisite by file slug', async () => {
    const h = await graphHarness();
    h.adapter.files.set(
      '.shipbench/tasks/archive/archived-foundation.md',
      '---\ntitle: [unclosed\n---\n\nbody\n',
    );

    await h.run('task', 'graph', '--archived', '--json');
    const graph = JSON.parse(h.stdout.join('\n'));

    expect(graph['archived-foundation']).toEqual({
      status: 'archived',
      depends_on: [],
      blocks: ['archive-consumer'],
    });
  });

  it('prints an ASCII dependency summary in an interactive terminal', async () => {
    const h = await graphHarness(true);

    await h.run('task', 'graph');

    expect(h.stdout[0]).toBe('Task dependency graph:');
    expect(h.stdout).toContain('+- api [in-progress]');
    expect(h.stdout).toContain('| +- depends on: foundation [done]');
    expect(h.stdout).toContain('| `- blocks: api [in-progress]');
    expect(() => JSON.parse(h.stdout.join('\n'))).toThrow();
  });

  it('--json overrides interactive text output and help documents both flags', async () => {
    const h = await graphHarness(true);

    await h.run('task', 'graph', '--json');
    expect(() => JSON.parse(h.stdout.join('\n'))).not.toThrow();

    const help = harness();
    await expect(help.run('task', 'graph', '--help')).rejects.toMatchObject({
      code: 'commander.helpDisplayed',
      exitCode: 0,
    });
    expect(help.stdout.join('\n')).toMatch(/--archived[\s\S]*--json/);
  });

  describe('for one task', () => {
    // foundation [done] <- api <- client
    // shared [todo]     <-/   <- docs <- (also waits on shared)
    async function focusedHarness(isInteractive = false): Promise<Harness> {
      const h = await graphHarness(isInteractive);
      await h.run('task', 'create', 'Shared');
      await h.run('task', 'edit', 'api', '--add-depends-on=shared');
      await h.run('task', 'create', 'Client', '--depends-on=api');
      await h.run('task', 'create', 'Docs', '--depends-on=api,shared');
      h.stdout.length = 0;
      return h;
    }

    it('emits the blockers and dependents of one task as JSON', async () => {
      const h = await focusedHarness();

      await h.run('task', 'graph', 'api');
      const query = JSON.parse(h.stdout.join('\n'));

      expect(query).toMatchObject({
        slug: 'api',
        status: 'in-progress',
        title: 'API',
        dependencies_satisfied: false,
        available: false,
        depth: null,
        truncated: false,
      });
      expect(query.blockers).toEqual([
        {
          slug: 'foundation',
          status: 'done',
          title: 'Foundation',
          satisfied: true,
          children: [],
        },
        {
          slug: 'shared',
          status: 'todo',
          title: 'Shared',
          satisfied: false,
          children: [],
        },
      ]);
      expect(query.dependents).toEqual([
        {
          slug: 'client',
          status: 'todo',
          title: 'Client',
          unblocks_on_completion: true,
          waiting_on: [],
          children: [],
        },
        {
          slug: 'docs',
          status: 'todo',
          title: 'Docs',
          unblocks_on_completion: false,
          waiting_on: ['shared'],
          children: [],
        },
      ]);
    });

    it('walks one direction transitively and marks what --depth cuts off', async () => {
      const h = await focusedHarness();

      await h.run('task', 'graph', 'shared', '--dependents', '--json');
      const full = JSON.parse(h.stdout.join('\n'));
      expect(full.blockers).toBeUndefined();
      expect(full.truncated).toBe(false);
      expect(
        full.dependents.map((node: { slug: string }) => node.slug),
      ).toEqual(['api', 'docs']);
      expect(full.dependents[0].children).toEqual([
        expect.objectContaining({ slug: 'client' }),
        expect.objectContaining({ slug: 'docs' }),
      ]);

      h.stdout.length = 0;
      await h.run('task', 'graph', 'client', '--blockers', '--depth=1');
      const cut = JSON.parse(h.stdout.join('\n'));
      expect(cut).toMatchObject({ depth: 1, truncated: true });
      expect(cut.blockers).toEqual([
        expect.objectContaining({
          slug: 'api',
          omitted: 'depth',
          children: [],
        }),
      ]);
    });

    it('counts an archived dependency as satisfied, as task list does', async () => {
      const h = await focusedHarness();

      await h.run('task', 'graph', 'archive-consumer', '--json');
      const query = JSON.parse(h.stdout.join('\n'));

      expect(query).toMatchObject({
        dependencies_satisfied: true,
        available: true,
      });
      expect(query.blockers).toEqual([
        {
          slug: 'archived-foundation',
          status: 'archived',
          satisfied: true,
          children: [],
        },
      ]);

      h.stdout.length = 0;
      await h.run('task', 'list', '--available', '--json');
      expect(JSON.parse(h.stdout.join('\n')).tasks).toContainEqual(
        expect.objectContaining({ slug: 'archive-consumer' }),
      );
    });

    it('queries an archived task only with --archived', async () => {
      const h = await focusedHarness();

      await expect(
        h.run('task', 'graph', 'archived-foundation'),
      ).rejects.toMatchObject({ code: 'commander.error', exitCode: 1 });
      expect(h.stderr.join('\n')).toContain(
        "Task 'archived-foundation' is archived. Pass --archived to query it.",
      );

      await h.run('task', 'graph', 'archived-foundation', '--archived');
      const query = JSON.parse(h.stdout.join('\n'));
      expect(query).toMatchObject({ status: 'archived', available: false });
      expect(query.dependents).toEqual([
        expect.objectContaining({
          slug: 'archive-consumer',
          unblocks_on_completion: false,
        }),
      ]);
    });

    it('reports a missing prerequisite and rejects an unknown slug', async () => {
      const h = await focusedHarness();

      await h.run('task', 'graph', 'dangling-consumer');
      expect(JSON.parse(h.stdout.join('\n')).blockers).toEqual([
        {
          slug: 'missing-target',
          status: 'missing',
          satisfied: false,
          children: [],
        },
      ]);

      await expect(h.run('task', 'graph', 'ghost')).rejects.toMatchObject({
        code: 'commander.error',
        exitCode: 1,
      });
      expect(h.stderr.join('\n')).toContain("Task 'ghost' not found.");
    });

    it('marks an unreadable prerequisite rather than calling it missing', async () => {
      const h = await focusedHarness();
      h.adapter.files.set(
        '.shipbench/tasks/shared.md',
        '---\ntitle: [unclosed\n---\n\nbody\n',
      );

      await h.run('task', 'graph', 'docs', '--blockers');
      const query = JSON.parse(h.stdout.join('\n'));

      expect(query.blockers).toContainEqual({
        slug: 'shared',
        status: 'unreadable',
        satisfied: false,
        children: [],
      });
    });

    it('prints a tree in an interactive terminal', async () => {
      const h = await focusedHarness(true);

      await h.run('task', 'graph', 'shared', '--depth=1');

      expect(h.stdout).toEqual([
        'shared [todo]: available',
        'Blockers: none',
        'Dependents:',
        '+- api [in-progress] (more beyond --depth)',
        '`- docs [todo] (waiting on api)',
        'Stopped at --depth 1; some branches continue past it.',
      ]);
    });

    it('refuses focused flags without a slug and leaves the full graph alone', async () => {
      const h = await focusedHarness();

      await expect(h.run('task', 'graph', '--blockers')).rejects.toMatchObject({
        code: 'commander.error',
        exitCode: 1,
      });
      expect(h.stderr.join('\n')).toContain(
        '--blockers, --dependents, and --depth need a task slug.',
      );
      await expect(
        h.run('task', 'graph', 'api', '--depth=0'),
      ).rejects.toMatchObject({ code: 'commander.invalidArgument' });

      await h.run('task', 'graph');
      expect(JSON.parse(h.stdout.join('\n')).api).toEqual({
        status: 'in-progress',
        depends_on: ['foundation', 'shared'],
        blocks: ['client', 'docs'],
      });
    });
  });
});

describe('shipbench task list --archived', () => {
  it('lists archived tasks with a label in text mode', async () => {
    const h = harness();
    await h.run('init');
    await h.run('task', 'create', 'Archived example');
    await h.run('task', 'archive', 'archived-example');
    h.stdout.length = 0;

    await h.run('task', 'list', '--archived');

    expect(h.stdout[0]).toBe('Archived tasks:');
    expect(h.stdout[1]).toBe('[todo] Archived example (archived-example)');
  });

  it('supports machine-readable JSON output', async () => {
    const h = harness();
    await h.run('init');
    await h.run('task', 'create', 'Archived example');
    await h.run('task', 'archive', 'archived-example');
    h.stdout.length = 0;

    await h.run('task', 'list', '--archived', '--json');
    const payload = JSON.parse(h.stdout.join('\n'));

    expect(payload.archived).toBe(true);
    expect(payload.tasks).toEqual([
      expect.objectContaining({
        slug: 'archived-example',
        depends_on: [],
      }),
    ]);
    expect(payload.tasks[0]).not.toHaveProperty('position');
    expect(payload.warnings).toEqual([]);
  });
});
