import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  type Harness,
  harness,
  setTaskCreated,
  setTaskUpdated,
} from './testing.js';

describe('shipbench task create', () => {
  let h: Harness;
  beforeEach(async () => {
    h = harness();
    await h.run('init');
    // Drop the welcome task to keep assertions clean.
    h.adapter.files.delete('.shipbench/tasks/welcome-to-shipbench.md');
    h.stdout.length = 0;
    h.stderr.length = 0;
  });

  it('creates a task with defaults', async () => {
    await h.run('task', 'create', 'Setup auth');
    expect(h.adapter.files.has('.shipbench/tasks/setup-auth.md')).toBe(true);
    expect(h.stdout).toEqual([]);
    expect(h.stderr.at(-1)).toBe('Created task: setup-auth');
  });

  it('prints the created task as JSON and skips the stderr confirmation', async () => {
    await h.run(
      'task',
      'create',
      'Setup auth',
      '--priority=high',
      '--tags=cli,auth',
      '--json',
    );
    expect(h.stderr).toEqual([]);
    const payload = JSON.parse(h.stdout.join('\n'));
    expect(Object.keys(payload)).toEqual([
      'slug',
      'status',
      'frontmatter',
      'body',
      'comments',
    ]);
    expect(payload).toEqual({
      slug: 'setup-auth',
      status: 'todo',
      frontmatter: expect.objectContaining({
        title: 'Setup auth',
        priority: 'high',
        tags: ['cli', 'auth'],
      }),
      body: expect.any(String),
      comments: [],
    });
  });

  it('uses config.default_column when --status is omitted', async () => {
    const rawConfig = h.adapter.files.get('.shipbench/config.json');
    expect(rawConfig).toBeDefined();
    const config = JSON.parse(rawConfig!);
    config.columns = [
      { id: 'blocked', label: 'Blocked' },
      { id: 'todo', label: 'To Do' },
      { id: 'done', label: 'Done' },
    ];
    config.default_column = 'todo';
    h.adapter.files.set(
      '.shipbench/config.json',
      `${JSON.stringify(config, null, 2)}\n`,
    );

    await h.run('task', 'create', 'Default status');

    const raw = h.adapter.files.get('.shipbench/tasks/default-status.md');
    expect(raw).toBeDefined();
    expect(matter(raw!).data.status).toBe('todo');
  });

  it('applies --status, --priority, --assignee, and --tags', async () => {
    await h.run(
      'task',
      'create',
      'Backend work',
      '--status=in-progress',
      '--priority=high',
      '--assignee=greg',
      '--tags=backend,api',
    );
    const raw = h.adapter.files.get('.shipbench/tasks/backend-work.md');
    expect(raw).toBeDefined();
    const { data } = matter(raw!);
    expect(data.status).toBe('in-progress');
    expect(data.priority).toBe('high');
    expect(data.assignee).toBe('greg');
    expect(data.tags).toEqual(['backend', 'api']);
  });

  it('accumulates a repeated --tags and drops case-insensitive duplicates', async () => {
    await h.run(
      'task',
      'create',
      'Repeated tags',
      '--tags=backend,api',
      '--tags',
      'urgent',
      '--tags=API',
    );
    const raw = h.adapter.files.get('.shipbench/tasks/repeated-tags.md');
    expect(matter(raw!).data.tags).toEqual(['backend', 'api', 'urgent']);
  });

  it('errors on an invalid status', async () => {
    await expect(
      h.run('task', 'create', 'X', '--status=mystery'),
    ).rejects.toThrow(/invalid status/i);
  });

  it('accepts --depends-on as a comma-separated list', async () => {
    await h.run('task', 'create', 'Api');
    await h.run('task', 'create', 'Schema');
    await h.run('task', 'create', 'Wire it up', '--depends-on=api,schema');

    const raw = h.adapter.files.get('.shipbench/tasks/wire-it-up.md');
    expect(raw).toBeDefined();
    expect(matter(raw!).data.depends_on).toEqual(['api', 'schema']);
  });

  it('errors when --depends-on names a task that does not exist', async () => {
    await expect(
      h.run('task', 'create', 'Wire it up', '--depends-on=ghost'),
    ).rejects.toThrow(/unknown dependency "ghost"/i);
  });
});

describe('shipbench task create with a description', () => {
  let h: Harness;
  beforeEach(async () => {
    h = harness();
    await h.run('init');
    h.adapter.files.delete('.shipbench/tasks/welcome-to-shipbench.md');
    h.stdout.length = 0;
    h.stderr.length = 0;
  });

  it('writes --body as the task description', async () => {
    await h.run('task', 'create', 'Setup auth', '--body', 'Wire up OAuth.');

    const raw = h.adapter.files.get('.shipbench/tasks/setup-auth.md');
    expect(matter(raw!).content.trim()).toBe('Wire up OAuth.');
  });

  it('reads a multi-line UTF-8 description from --body-file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'shipbench-body-'));
    const path = join(dir, 'body.md');
    const body = '# Heading\n\nAn em dash — and café, kept verbatim.';
    await writeFile(path, body, 'utf8');

    try {
      await h.run('task', 'create', 'From file', '--body-file', path);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    const raw = h.adapter.files.get('.shipbench/tasks/from-file.md');
    expect(matter(raw!).content.trim()).toBe(body);
  });

  it('reads the description from stdin for --body-file -', async () => {
    const piped = harness(undefined, {
      readStdin: async () => 'Piped description.',
    });
    await piped.run('init');
    await piped.run('task', 'create', 'Piped', '--body-file', '-');

    const raw = piped.adapter.files.get('.shipbench/tasks/piped.md');
    expect(matter(raw!).content.trim()).toBe('Piped description.');
  });

  it('rejects --body together with --body-file', async () => {
    await expect(
      h.run('task', 'create', 'Both', '--body', 'x', '--body-file', 'y.md'),
    ).rejects.toMatchObject({ code: 'commander.conflictingOption' });
    expect(h.adapter.files.has('.shipbench/tasks/both.md')).toBe(false);
  });

  it('names the path when --body-file cannot be read', async () => {
    await expect(
      h.run('task', 'create', 'Missing file', '--body-file', 'no-such.md'),
    ).rejects.toThrow(/Cannot read --body-file "no-such\.md"/);
    expect(h.adapter.files.has('.shipbench/tasks/missing-file.md')).toBe(false);
  });

  it('rejects a description carrying the Updates marker', async () => {
    await expect(
      h.run(
        'task',
        'create',
        'Sneaky',
        '--body',
        'Description\n\n## Task Updates\n\n### 2026-01-01T00:00:00Z\nNope.',
      ),
    ).rejects.toThrow(/task comment/);
    expect(h.adapter.files.has('.shipbench/tasks/sneaky.md')).toBe(false);
  });
});

describe('shipbench task edit', () => {
  let h: Harness;
  beforeEach(async () => {
    h = harness();
    await h.run('init');
    h.adapter.files.delete('.shipbench/tasks/welcome-to-shipbench.md');
    await h.run('task', 'create', 'Build api', '--body', 'Original text.');
    setTaskCreated(h, 'build-api', '2026-01-01T00:00:00.000Z');
    setTaskUpdated(h, 'build-api', '2026-01-01T00:00:00.000Z');
    h.stdout.length = 0;
    h.stderr.length = 0;
  });

  it('replaces the description, preserving created and bumping updated', async () => {
    await h.run('task', 'edit', 'build-api', '--body', 'Rewritten text.');

    const parsed = matter(
      h.adapter.files.get('.shipbench/tasks/build-api.md')!,
    );
    expect(parsed.content.trim()).toBe('Rewritten text.');
    expect(parsed.data.created).toBe('2026-01-01T00:00:00.000Z');
    expect(Date.parse(parsed.data.updated)).toBeGreaterThan(
      Date.parse('2026-01-01T00:00:00.000Z'),
    );
    expect(h.stdout).toEqual([]);
    expect(h.stderr.at(-1)).toBe('Updated build-api: description');
  });

  it('leaves the Updates section untouched', async () => {
    await h.run('task', 'comment', 'build-api', 'Scope changed after review.');
    await h.run('task', 'edit', 'build-api', '--body', 'Rewritten text.');

    const written = h.adapter.files.get('.shipbench/tasks/build-api.md') ?? '';
    expect(written).toContain('Rewritten text.');
    expect(written).toContain('## Task Updates');
    expect(written).toContain('Scope changed after review.');
    expect(written).not.toContain('Original text.');
  });

  it('clears the description when given an empty body', async () => {
    await h.run('task', 'edit', 'build-api', '--body', '');

    const parsed = matter(
      h.adapter.files.get('.shipbench/tasks/build-api.md')!,
    );
    expect(parsed.content.trim()).toBe('');
    expect(h.stderr.at(-1)).toBe('Updated build-api: description cleared');
  });

  it('reads a UTF-8 description from --body-file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'shipbench-body-'));
    const path = join(dir, 'body.md');
    const body = 'Rewritten — with café and 日本語.';
    await writeFile(path, body, 'utf8');

    try {
      await h.run('task', 'edit', 'build-api', '--body-file', path);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    const parsed = matter(
      h.adapter.files.get('.shipbench/tasks/build-api.md')!,
    );
    expect(parsed.content.trim()).toBe(body);
  });

  it('emits the edited task as JSON and skips the stderr confirmation', async () => {
    await h.run('task', 'comment', 'build-api', 'Scope changed after review.');
    h.stdout.length = 0;
    h.stderr.length = 0;

    await h.run('task', 'edit', 'build-api', '--body', 'Rewritten.', '--json');

    expect(h.stderr).toEqual([]);
    const payload = JSON.parse(h.stdout.join('\n'));
    expect(payload).toMatchObject({
      slug: 'build-api',
      status: 'todo',
      body: 'Rewritten.',
      comments: [
        {
          timestamp: expect.any(String),
          text: 'Scope changed after review.',
        },
      ],
    });
  });

  it('requires at least one change', async () => {
    await expect(h.run('task', 'edit', 'build-api')).rejects.toMatchObject({
      code: 'commander.error',
      exitCode: 1,
    });
    expect(h.stderr.join('\n')).toContain('Provide at least one change');
  });

  it('rejects an unknown task', async () => {
    await expect(
      h.run('task', 'edit', 'ghost', '--body', 'x'),
    ).rejects.toMatchObject({ code: 'commander.error', exitCode: 1 });
    expect(h.stderr.join('\n')).toContain("Task 'ghost' not found.");
  });

  it('points at unarchive when the task is archived', async () => {
    await h.run('task', 'move', 'build-api', '--to=done');
    await h.run('task', 'archive', 'build-api');
    h.stderr.length = 0;

    await expect(
      h.run('task', 'edit', 'build-api', '--body', 'x'),
    ).rejects.toMatchObject({ code: 'commander.error', exitCode: 1 });
    expect(h.stderr.join('\n')).toContain(
      "Task 'build-api' is archived. Unarchive it before editing.",
    );
  });

  it('rejects a description carrying the Updates marker', async () => {
    await expect(
      h.run(
        'task',
        'edit',
        'build-api',
        '--body',
        'Text\n\n## Task Updates\n\n### 2026-01-01T00:00:00Z\nNope.',
      ),
    ).rejects.toThrow(/task comment/);
    const parsed = matter(
      h.adapter.files.get('.shipbench/tasks/build-api.md')!,
    );
    expect(parsed.content.trim()).toBe('Original text.');
  });
});

describe('shipbench task edit (metadata)', () => {
  let h: Harness;
  beforeEach(async () => {
    h = harness();
    await h.run('init');
    h.adapter.files.delete('.shipbench/tasks/welcome-to-shipbench.md');
    await h.run(
      'task',
      'create',
      'Build api',
      '--priority=low',
      '--tags=backend,api',
      '--assignee=greg',
      '--body',
      'Original text.',
    );
    await h.run('task', 'create', 'Ship auth');
    setTaskCreated(h, 'build-api', '2026-01-01T00:00:00.000Z');
    setTaskUpdated(h, 'build-api', '2026-01-01T00:00:00.000Z');
    h.stdout.length = 0;
    h.stderr.length = 0;
  });

  const frontmatter = (slug = 'build-api') =>
    matter(h.adapter.files.get(`.shipbench/tasks/${slug}.md`)!).data;

  it('sets priority and assignee through core validation', async () => {
    await h.run(
      'task',
      'edit',
      'build-api',
      '--priority=high',
      '--assignee=claude',
    );
    const data = frontmatter();
    expect(data.priority).toBe('high');
    expect(data.assignee).toBe('claude');
    expect(data.created).toBe('2026-01-01T00:00:00.000Z');
    expect(Date.parse(data.updated)).toBeGreaterThan(
      Date.parse('2026-01-01T00:00:00.000Z'),
    );
  });

  it('rejects an invalid priority without writing any change', async () => {
    await expect(
      h.run(
        'task',
        'edit',
        'build-api',
        '--assignee=claude',
        '--priority=nope',
      ),
    ).rejects.toThrow(/Invalid priority/);
    const data = frontmatter();
    expect(data.priority).toBe('low');
    expect(data.assignee).toBe('greg');
  });

  it('replaces tags with --tags and clears them with --clear-tags', async () => {
    await h.run('task', 'edit', 'build-api', '--tags=ui,ux');
    expect(frontmatter().tags).toEqual(['ui', 'ux']);
    await h.run('task', 'edit', 'build-api', '--clear-tags');
    expect(frontmatter().tags).toBeUndefined();
  });

  it('adds and removes tags incrementally', async () => {
    await h.run(
      'task',
      'edit',
      'build-api',
      '--add-tag=urgent,api',
      '--remove-tag=backend',
    );
    // backend removed, api de-duplicated, urgent appended.
    expect(frontmatter().tags).toEqual(['api', 'urgent']);
  });

  it('clears the assignee with --clear-assignee', async () => {
    await h.run('task', 'edit', 'build-api', '--clear-assignee');
    expect(frontmatter().assignee).toBeUndefined();
  });

  it('rejects --assignee together with --clear-assignee', async () => {
    await expect(
      h.run('task', 'edit', 'build-api', '--assignee=x', '--clear-assignee'),
    ).rejects.toMatchObject({ code: 'commander.conflictingOption' });
  });

  it('replaces and validates dependencies, keeping the slug on a title edit', async () => {
    await h.run('task', 'edit', 'build-api', '--depends-on=ship-auth');
    expect(frontmatter().depends_on).toEqual(['ship-auth']);

    await expect(
      h.run('task', 'edit', 'build-api', '--depends-on=ghost'),
    ).rejects.toThrow(/Unknown dependency/);
    expect(frontmatter().depends_on).toEqual(['ship-auth']);

    await h.run('task', 'edit', 'build-api', '--clear-depends-on');
    expect(frontmatter().depends_on).toBeUndefined();
  });

  it('changes the title without renaming the file', async () => {
    await h.run('task', 'edit', 'build-api', '--title=Build the REST API');
    expect(h.adapter.files.has('.shipbench/tasks/build-api.md')).toBe(true);
    expect(frontmatter().title).toBe('Build the REST API');
    expect(h.stderr.join('\n')).toContain('Slug and filename unchanged');
  });

  it('rejects an empty title', async () => {
    await expect(
      h.run('task', 'edit', 'build-api', '--title=   '),
    ).rejects.toThrow(/slug-able/);
  });

  it('preserves the description, Updates, and unknown fields on a metadata edit', async () => {
    await h.run('task', 'comment', 'build-api', 'Scope changed after review.');
    const path = '.shipbench/tasks/build-api.md';
    const withExtra = h.adapter.files
      .get(path)!
      .replace('priority: low', 'priority: low\nx_custom: keep-me');
    h.adapter.files.set(path, withExtra);
    h.stderr.length = 0;

    await h.run('task', 'edit', 'build-api', '--priority=medium');

    const written = h.adapter.files.get(path)!;
    expect(written).toContain('Original text.');
    expect(written).toContain('## Task Updates');
    expect(written).toContain('Scope changed after review.');
    expect(written).toContain('x_custom: keep-me');
  });

  it('applies description and metadata in one confirmation line', async () => {
    await h.run(
      'task',
      'edit',
      'build-api',
      '--priority=high',
      '--body',
      'Rewritten.',
    );
    expect(h.stderr.at(-1)).toBe(
      'Updated build-api: priority low → high; description',
    );
  });

  it('reports when every requested value already matches', async () => {
    await h.run('task', 'edit', 'build-api', '--priority=low');
    expect(h.stderr.at(-1)).toContain('No changes for build-api');
    expect(frontmatter().updated).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('shipbench task create --depends-on (repeated)', () => {
  it('accumulates a repeated --depends-on flag', async () => {
    const h = harness();
    await h.run('init');
    h.adapter.files.delete('.shipbench/tasks/welcome-to-shipbench.md');
    await h.run('task', 'create', 'Api');
    await h.run('task', 'create', 'Schema');
    await h.run(
      'task',
      'create',
      'Wire it up',
      '--depends-on=api',
      '--depends-on=schema',
    );

    const raw = h.adapter.files.get('.shipbench/tasks/wire-it-up.md');
    expect(raw).toBeDefined();
    expect(matter(raw!).data.depends_on).toEqual(['api', 'schema']);
  });
});

describe('related tasks', () => {
  let h: Harness;
  beforeEach(async () => {
    h = harness();
    await h.run('init');
    h.adapter.files.delete('.shipbench/tasks/welcome-to-shipbench.md');
    await h.run('task', 'create', 'Api');
    await h.run('task', 'create', 'Schema');
    await h.run('task', 'create', 'Spike', '--status=done');
    await h.run('task', 'archive', 'spike');
    h.stdout.length = 0;
    h.stderr.length = 0;
  });

  const frontmatter = (slug: string) =>
    matter(h.adapter.files.get(`.shipbench/tasks/${slug}.md`)!).data;

  const listJson = async (...args: string[]) => {
    h.stdout.length = 0;
    await h.run('task', 'list', '--json', ...args);
    return JSON.parse(h.stdout.join('\n'));
  };

  it('creates a task with live and archived related tasks', async () => {
    await h.run(
      'task',
      'create',
      'Wire it up',
      '--related=api',
      '--related=spike',
    );
    expect(frontmatter('wire-it-up').related).toEqual(['api', 'spike']);
  });

  it('replaces, adds, removes, and clears in validated writes', async () => {
    await h.run('task', 'edit', 'api', '--related=schema');
    expect(frontmatter('api').related).toEqual(['schema']);

    await h.run('task', 'edit', 'api', '--add-related=spike');
    expect(frontmatter('api').related).toEqual(['schema', 'spike']);

    await h.run('task', 'edit', 'api', '--remove-related=schema');
    expect(frontmatter('api').related).toEqual(['spike']);
    expect(h.stderr.at(-1)).toBe(
      'Updated api: related [schema, spike] → [spike]',
    );

    await h.run('task', 'edit', 'api', '--clear-related');
    expect(frontmatter('api').related).toBeUndefined();
  });

  it('rejects an unknown slug and leaves the task untouched', async () => {
    await h.run('task', 'edit', 'api', '--related=schema');
    const before = h.adapter.files.get('.shipbench/tasks/api.md');

    await expect(
      h.run('task', 'edit', 'api', '--add-related=ghost', '--priority=high'),
    ).rejects.toThrow(/Unknown related task "ghost"/);
    expect(h.adapter.files.get('.shipbench/tasks/api.md')).toBe(before);
  });

  it('rejects removing a link recorded on the other task', async () => {
    await h.run('task', 'edit', 'schema', '--related=api');
    const before = h.adapter.files.get('.shipbench/tasks/api.md');

    await expect(
      h.run('task', 'edit', 'api', '--remove-related=schema'),
    ).rejects.toThrow(/recorded in schema's file/);
    expect(h.adapter.files.get('.shipbench/tasks/api.md')).toBe(before);
  });

  it('rejects removing a link recorded on an archived task', async () => {
    const path = '.shipbench/tasks/archive/spike.md';
    const parsed = matter(h.adapter.files.get(path)!);
    parsed.data.related = ['api'];
    h.adapter.files.set(path, matter.stringify(parsed.content, parsed.data));

    await expect(
      h.run('task', 'edit', 'api', '--remove-related=spike'),
    ).rejects.toThrow(/archived task spike's file.*Unarchive spike/);
  });

  it('rejects the related flags in conflicting combinations', async () => {
    await expect(
      h.run('task', 'edit', 'api', '--related=schema', '--clear-related'),
    ).rejects.toMatchObject({ code: 'commander.conflictingOption' });
  });

  it('shows both directions in list JSON, resolved and shown once', async () => {
    await h.run('task', 'edit', 'api', '--related=schema,spike');
    await h.run('task', 'edit', 'schema', '--related=api');

    const payload = await listJson();
    const bySlug = new Map(
      payload.tasks.map((task: { slug: string }) => [task.slug, task]),
    );

    expect(bySlug.get('api')).toMatchObject({
      related: ['schema', 'spike'],
      related_tasks: [
        {
          slug: 'schema',
          direction: 'both',
          title: 'Schema',
          status: 'todo',
          archived: false,
        },
        {
          slug: 'spike',
          direction: 'outgoing',
          title: 'Spike',
          status: 'done',
          archived: true,
        },
      ],
    });
    expect(bySlug.get('schema')).toMatchObject({
      related: ['api'],
      related_tasks: [{ slug: 'api', direction: 'both', title: 'Api' }],
    });
    expect(payload.warnings).toEqual([]);
  });

  it('shows the incoming side on an archived task in list --archived JSON', async () => {
    await h.run('task', 'edit', 'api', '--related=spike');

    const payload = await listJson('--archived');

    expect(payload.tasks[0]).toMatchObject({
      slug: 'spike',
      related: [],
      related_tasks: [
        {
          slug: 'api',
          direction: 'incoming',
          title: 'Api',
          status: 'todo',
          archived: false,
        },
      ],
    });
  });

  it('shows related tasks in search JSON', async () => {
    await h.run('task', 'edit', 'schema', '--related=api');
    h.stdout.length = 0;

    await h.run('task', 'search', 'Api', '--json');
    const payload = JSON.parse(h.stdout.join('\n'));

    expect(payload.matches[0]).toMatchObject({
      slug: 'api',
      related_tasks: [{ slug: 'schema', direction: 'incoming' }],
    });
  });

  it('reports the frontmatter as written from task get', async () => {
    await h.run('task', 'edit', 'schema', '--related=api');
    h.stdout.length = 0;

    await h.run('task', 'get', 'api');
    const payload = JSON.parse(h.stdout.join('\n'));

    expect(payload.frontmatter).not.toHaveProperty('related');
    expect(payload).not.toHaveProperty('related_tasks');
  });

  it('keeps related out of availability and the dependency graph', async () => {
    await h.run('task', 'move', 'schema', '--to=in-progress');
    await h.run('task', 'edit', 'api', '--related=schema');

    const available = await listJson('--available');
    expect(available.tasks.map((task: { slug: string }) => task.slug)).toEqual([
      'api',
    ]);

    h.stdout.length = 0;
    await h.run('task', 'graph', '--json');
    expect(h.stdout.join('\n')).not.toContain('related');
  });
});

describe('shipbench task comment', () => {
  // `init` scaffolds one Update on the welcome task; these tests add theirs after it.
  const SCAFFOLDED = 1;

  it('appends a timestamped Updates entry end to end', async () => {
    const h = harness();
    await h.run('init');
    h.stdout.length = 0;
    h.stderr.length = 0;
    const before = Date.now();

    await h.run(
      'task',
      'comment',
      'welcome-to-shipbench',
      'Scope expanded after review.',
    );
    const after = Date.now();

    expect(h.stdout).toEqual([]);
    expect(h.stderr).toEqual(['Added update to welcome-to-shipbench']);
    const raw =
      h.adapter.files.get('.shipbench/tasks/welcome-to-shipbench.md') ?? '';
    expect(raw).toContain('## Task Updates');
    expect(raw).toContain('Scope expanded after review.');

    h.stdout.length = 0;
    await h.run('task', 'get', 'welcome-to-shipbench');
    const payload = JSON.parse(h.stdout.join('\n'));
    expect(payload.body).toContain('Your ShipBench project board');
    expect(payload.comments.slice(SCAFFOLDED)).toEqual([
      {
        timestamp: expect.any(String),
        text: 'Scope expanded after review.',
      },
    ]);
    const timestamp = Date.parse(payload.comments[SCAFFOLDED].timestamp);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
    expect(payload.frontmatter.updated).toBe(
      payload.comments[SCAFFOLDED].timestamp,
    );
  });

  it('rejects blank update text', async () => {
    const h = harness();
    await h.run('init');

    await expect(
      h.run('task', 'comment', 'welcome-to-shipbench', '   '),
    ).rejects.toThrow(/must not be blank/i);
  });

  it('reads a multi-line UTF-8 update from --body-file', async () => {
    const h = harness();
    await h.run('init');
    const dir = await mkdtemp(join(tmpdir(), 'shipbench-update-'));
    const path = join(dir, 'update.md');
    const text = '# Rolled back\n\nAn em dash — and café, kept verbatim.';
    await writeFile(path, text, 'utf8');

    try {
      await h.run(
        'task',
        'comment',
        'welcome-to-shipbench',
        '--body-file',
        path,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    h.stdout.length = 0;
    await h.run('task', 'get', 'welcome-to-shipbench');
    expect(JSON.parse(h.stdout.join('\n')).comments.slice(SCAFFOLDED)).toEqual([
      { timestamp: expect.any(String), text },
    ]);
  });

  it('reads the update text from stdin for --body-file -', async () => {
    const h = harness(undefined, { readStdin: async () => 'Piped update.' });
    await h.run('init');

    await h.run('task', 'comment', 'welcome-to-shipbench', '--body-file', '-');

    h.stdout.length = 0;
    await h.run('task', 'get', 'welcome-to-shipbench');
    expect(JSON.parse(h.stdout.join('\n')).comments.slice(SCAFFOLDED)).toEqual([
      { timestamp: expect.any(String), text: 'Piped update.' },
    ]);
  });

  it('replaces an entry from --body-file without changing its timestamp', async () => {
    const h = harness();
    await h.run('init');
    await h.run('task', 'comment', 'welcome-to-shipbench', 'Original.');
    h.stdout.length = 0;
    await h.run('task', 'get', 'welcome-to-shipbench');
    const originalTimestamp = JSON.parse(h.stdout.join('\n')).comments[
      SCAFFOLDED
    ].timestamp;

    const dir = await mkdtemp(join(tmpdir(), 'shipbench-update-'));
    const path = join(dir, 'update.md');
    await writeFile(path, '## Corrected\n\nWith a heading.', 'utf8');
    try {
      await h.run(
        'task',
        'comment',
        'edit',
        'welcome-to-shipbench',
        String(SCAFFOLDED),
        '--body-file',
        path,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    h.stdout.length = 0;
    await h.run('task', 'get', 'welcome-to-shipbench');
    expect(JSON.parse(h.stdout.join('\n')).comments.slice(SCAFFOLDED)).toEqual([
      {
        timestamp: originalTimestamp,
        text: '## Corrected\n\nWith a heading.',
      },
    ]);
  });

  it('refuses the update text twice over', async () => {
    const h = harness();
    await h.run('init');

    await expect(
      h.run(
        'task',
        'comment',
        'welcome-to-shipbench',
        'Positional.',
        '--body',
        'Option.',
      ),
    ).rejects.toThrow(/Pass the update text once/);
  });

  it('requires the update text in some form', async () => {
    const h = harness();
    await h.run('init');

    await expect(
      h.run('task', 'comment', 'welcome-to-shipbench'),
    ).rejects.toThrow(/--body-file/);
  });

  it('keeps a heading in update text out of the parser', async () => {
    const h = harness();
    await h.run('init');
    const text = 'Rolled back.\n\n#### What broke\nThe backfill deadlocked.';

    await h.run('task', 'comment', 'welcome-to-shipbench', '--body', text);

    h.stdout.length = 0;
    h.stderr.length = 0;
    await h.run('task', 'get', 'welcome-to-shipbench');
    expect(h.stderr).toEqual([]);
    expect(JSON.parse(h.stdout.join('\n')).comments.slice(SCAFFOLDED)).toEqual([
      { timestamp: expect.any(String), text },
    ]);
  });

  it('refuses update text that would not read back', async () => {
    const h = harness();
    await h.run('init');
    const before = h.adapter.files.get(
      '.shipbench/tasks/welcome-to-shipbench.md',
    );

    await expect(
      h.run(
        'task',
        'comment',
        'welcome-to-shipbench',
        '--body',
        'Done.\n\n### 2026-07-24T20:00:00Z\nSecond thought.',
      ),
    ).rejects.toThrow(/reads as an entry heading/);
    expect(
      h.adapter.files.get('.shipbench/tasks/welcome-to-shipbench.md'),
    ).toBe(before);
  });

  it('edits and deletes Updates entries by zero-based index', async () => {
    const h = harness();
    await h.run('init');
    await h.run(
      'task',
      'comment',
      'welcome-to-shipbench',
      'Original decision.',
    );
    h.stdout.length = 0;
    await h.run('task', 'get', 'welcome-to-shipbench');
    const appended = JSON.parse(h.stdout.join('\n'));
    const originalTimestamp = appended.comments[SCAFFOLDED].timestamp;

    h.stdout.length = 0;
    h.stderr.length = 0;
    await h.run(
      'task',
      'comment',
      'edit',
      'welcome-to-shipbench',
      String(SCAFFOLDED),
      'Corrected decision.',
    );
    expect(h.stdout).toEqual([]);
    expect(h.stderr).toEqual([
      `Edited update ${SCAFFOLDED} on welcome-to-shipbench`,
    ]);

    h.stdout.length = 0;
    await h.run('task', 'get', 'welcome-to-shipbench');
    const edited = JSON.parse(h.stdout.join('\n'));
    expect(edited.comments.slice(SCAFFOLDED)).toEqual([
      {
        timestamp: originalTimestamp,
        text: 'Corrected decision.',
      },
    ]);

    h.stdout.length = 0;
    h.stderr.length = 0;
    await h.run(
      'task',
      'comment',
      'delete',
      'welcome-to-shipbench',
      String(SCAFFOLDED),
    );
    expect(h.stdout).toEqual([]);
    expect(h.stderr).toEqual([
      `Deleted update ${SCAFFOLDED} from welcome-to-shipbench`,
    ]);

    h.stdout.length = 0;
    await h.run('task', 'get', 'welcome-to-shipbench');
    const deleted = JSON.parse(h.stdout.join('\n'));
    expect(deleted.comments).toEqual(edited.comments.slice(0, SCAFFOLDED));

    // Deleting the last entry removes the section heading too.
    await h.run('task', 'comment', 'delete', 'welcome-to-shipbench', '0');
    expect(
      h.adapter.files.get('.shipbench/tasks/welcome-to-shipbench.md'),
    ).not.toContain('## Task Updates');
  });
});
