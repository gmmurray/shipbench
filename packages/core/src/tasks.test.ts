import matter from 'gray-matter';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './defaults.js';
import {
  ArchiveBlockedError,
  addComment,
  archiveTask,
  createTask,
  deleteComment,
  deleteTask,
  editComment,
  getTask,
  listArchivedTasks,
  listTasks,
  moveTask,
  reorderTask,
  taskFileSlugs,
  unarchiveTask,
  updateTask,
} from './tasks.js';
import type { ShipbenchConfig, StorageAdapter, Task } from './types.js';

function memoryAdapter(seed: Record<string, string> = {}): StorageAdapter & {
  files: Map<string, string>;
} {
  const files = new Map([
    ['.shipbench/config.json', `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`],
    ...Object.entries(seed),
  ]);

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
      const out: string[] = [];
      for (const p of files.keys()) {
        if (!p.startsWith(prefix)) continue;
        const relativePath = p.slice(prefix.length);
        if (!relativePath.includes('/')) out.push(relativePath);
      }
      return out;
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

function taskFile(frontmatter: Record<string, unknown>, body = ''): string {
  return matter.stringify(`\n${body}\n`, frontmatter);
}

describe('createTask', () => {
  it('writes a task with auto-managed timestamps and a slug derived from the title', async () => {
    const adapter = memoryAdapter();
    const before = Date.now();
    const task = await createTask(
      adapter,
      DEFAULT_CONFIG,
      'Setup GitHub OAuth',
    );
    const after = Date.now();

    expect(task.slug).toBe('setup-github-oauth');
    expect(adapter.files.has('.shipbench/tasks/setup-github-oauth.md')).toBe(
      true,
    );
    expect(task.frontmatter.created).toBe(task.frontmatter.updated);

    const created = Date.parse(task.frontmatter.created);
    expect(created).toBeGreaterThanOrEqual(before);
    expect(created).toBeLessThanOrEqual(after);
  });

  it('defaults status to the configured default column when none provided', async () => {
    const adapter = memoryAdapter();
    const config: ShipbenchConfig = {
      ...DEFAULT_CONFIG,
      columns: [
        { id: 'blocked', label: 'Blocked' },
        { id: 'todo', label: 'To Do' },
        { id: 'done', label: 'Done' },
      ],
      default_column: 'todo',
    };
    const task = await createTask(adapter, config, 'a');
    expect(task.frontmatter.status).toBe('todo');
  });

  it('defaults priority to the configured default', async () => {
    const adapter = memoryAdapter();
    const task = await createTask(adapter, DEFAULT_CONFIG, 'a');
    expect(task.frontmatter.priority).toBe(DEFAULT_CONFIG.priority.default);
  });

  it('rejects an invalid status', async () => {
    const adapter = memoryAdapter();
    await expect(
      createTask(adapter, DEFAULT_CONFIG, 'a', { status: 'nope' }),
    ).rejects.toThrow(/invalid status/i);
  });

  it('rejects an invalid priority', async () => {
    const adapter = memoryAdapter();
    await expect(
      createTask(adapter, DEFAULT_CONFIG, 'a', { priority: 'urgent' }),
    ).rejects.toThrow(/invalid priority/i);
  });

  it('rejects an empty title', async () => {
    const adapter = memoryAdapter();
    await expect(createTask(adapter, DEFAULT_CONFIG, '')).rejects.toThrow(
      /title/i,
    );
  });

  it('rejects a title that slugifies to empty', async () => {
    const adapter = memoryAdapter();
    await expect(createTask(adapter, DEFAULT_CONFIG, '!!!')).rejects.toThrow(
      /title/i,
    );
  });

  it('resolves slug collisions with numeric suffix', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/my-task.md': taskFile({
        title: 'My Task',
        status: 'todo',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }),
    });
    const task = await createTask(adapter, DEFAULT_CONFIG, 'My Task');
    expect(task.slug).toBe('my-task-2');
  });

  it('does not reuse a slug held by an archived task', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/archive/my-task.md': taskFile({
        title: 'My Task',
        status: 'done',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }),
    });

    const task = await createTask(adapter, DEFAULT_CONFIG, 'My Task');

    expect(task.slug).toBe('my-task-2');
  });

  it('appends the new slug to layout[status] so it has a stable position', async () => {
    const adapter = memoryAdapter();
    const config = { ...DEFAULT_CONFIG, layout: { todo: ['existing'] } };
    await createTask(adapter, config, 'New task', { status: 'todo' });

    const layout = JSON.parse(
      adapter.files.get('.shipbench/layout.json') ?? '{}',
    );
    expect(layout.todo).toEqual(['existing', 'new-task']);
  });
});

describe('updateTask', () => {
  let adapter: ReturnType<typeof memoryAdapter>;
  const originalCreated = '2026-01-01T00:00:00.000Z';

  beforeEach(async () => {
    adapter = memoryAdapter({
      '.shipbench/tasks/my-task.md': taskFile({
        title: 'My Task',
        status: 'todo',
        priority: 'medium',
        created: originalCreated,
        updated: originalCreated,
      }),
    });
  });

  it('updates the `updated` timestamp to now', async () => {
    const before = Date.now();
    const { task } = await updateTask(adapter, DEFAULT_CONFIG, 'my-task', {
      priority: 'high',
    });
    const after = Date.now();

    const updated = Date.parse(task.frontmatter.updated);
    expect(updated).toBeGreaterThanOrEqual(before);
    expect(updated).toBeLessThanOrEqual(after);
  });

  it('never modifies the `created` timestamp, even if the caller tries', async () => {
    const { task } = await updateTask(adapter, DEFAULT_CONFIG, 'my-task', {
      created: '1999-01-01T00:00:00.000Z',
    } as Partial<Task['frontmatter']>);
    expect(task.frontmatter.created).toBe(originalCreated);
  });

  it('rejects an invalid status', async () => {
    await expect(
      updateTask(adapter, DEFAULT_CONFIG, 'my-task', { status: 'nope' }),
    ).rejects.toThrow(/invalid status/i);
  });

  it('rejects an invalid priority', async () => {
    await expect(
      updateTask(adapter, DEFAULT_CONFIG, 'my-task', { priority: 'urgent' }),
    ).rejects.toThrow(/invalid priority/i);
  });

  it('updates the body when provided', async () => {
    const { task } = await updateTask(
      adapter,
      DEFAULT_CONFIG,
      'my-task',
      {},
      'fresh body',
    );
    expect(task.body).toBe('fresh body');
  });

  it('leaves parsed Updates entries untouched when editing the description', async () => {
    adapter.files.set(
      '.shipbench/tasks/my-task.md',
      taskFile(
        {
          title: 'My Task',
          status: 'todo',
          created: originalCreated,
          updated: originalCreated,
        },
        `Original description

## Task Updates

### 2026-07-24T20:00:00Z
Customer escalation made this high priority.`,
      ),
    );

    const { task } = await updateTask(
      adapter,
      DEFAULT_CONFIG,
      'my-task',
      {},
      'Rewritten description',
    );
    const written = adapter.files.get('.shipbench/tasks/my-task.md') ?? '';

    expect(task.body).toBe('Rewritten description');
    expect(task.comments).toEqual([
      {
        timestamp: '2026-07-24T20:00:00Z',
        text: 'Customer escalation made this high priority.',
      },
    ]);
    expect(written).toContain('Rewritten description');
    expect(written).toContain('### 2026-07-24T20:00:00Z');
    expect(written).toContain('Customer escalation made this high priority.');
  });

  it('updates layout.json when status changes', async () => {
    const customAdapter = memoryAdapter({
      '.shipbench/layout.json': JSON.stringify({ todo: ['my-task'] }),
      '.shipbench/tasks/my-task.md': taskFile({
        title: 'My Task',
        status: 'todo',
        created: originalCreated,
        updated: originalCreated,
      }),
    });
    await updateTask(customAdapter, DEFAULT_CONFIG, 'my-task', {
      status: 'in-progress',
    });
    const layout = JSON.parse(
      await customAdapter.readFile('.shipbench/layout.json'),
    );
    expect(layout).toEqual({ 'in-progress': ['my-task'] });
  });
});

describe('addComment', () => {
  it('appends a timestamped update and preserves the description', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/my-task.md': taskFile(
        {
          title: 'My Task',
          status: 'todo',
          created: '2026-01-01T00:00:00.000Z',
          updated: '2026-01-01T00:00:00.000Z',
        },
        'Timeless description.',
      ),
    });
    const before = Date.now();

    const task = await addComment(
      adapter,
      DEFAULT_CONFIG,
      'my-task',
      '  Scope expanded after the API review.  ',
    );
    const after = Date.now();
    const timestamp = Date.parse(task.comments[0]!.timestamp);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
    expect(task.frontmatter.updated).toBe(task.comments[0]!.timestamp);
    expect(task.body).toBe('Timeless description.');
    expect(task.comments[0]!.text).toBe('Scope expanded after the API review.');

    const reread = await listTasks(adapter, DEFAULT_CONFIG);
    expect(reread.tasks[0]).toMatchObject({
      body: 'Timeless description.',
      comments: task.comments,
    });
  });

  it('rejects blank text without changing the task file', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/my-task.md': taskFile({
        title: 'My Task',
        status: 'todo',
        created: '2026-01-01T00:00:00.000Z',
        updated: '2026-01-01T00:00:00.000Z',
      }),
    });
    const original = adapter.files.get('.shipbench/tasks/my-task.md');

    await expect(
      addComment(adapter, DEFAULT_CONFIG, 'my-task', '   '),
    ).rejects.toThrow(/must not be blank/i);
    expect(adapter.files.get('.shipbench/tasks/my-task.md')).toBe(original);
  });
});

describe('editComment and deleteComment', () => {
  const seededTask = () =>
    taskFile(
      {
        title: 'My Task',
        status: 'todo',
        created: '2026-01-01T00:00:00.000Z',
        updated: '2026-01-02T00:00:00.000Z',
      },
      `Timeless description.

## Task Updates

### 2026-01-01T12:00:00.000Z
First decision.

### 2026-01-02T12:00:00.000Z
Second decision.`,
    );

  it('edits only the selected text and keeps its timestamp immutable', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/my-task.md': seededTask(),
    });

    const task = await editComment(
      adapter,
      DEFAULT_CONFIG,
      'my-task',
      0,
      '  Corrected first decision.  ',
    );

    expect(task.body).toBe('Timeless description.');
    expect(task.comments).toEqual([
      {
        timestamp: '2026-01-01T12:00:00.000Z',
        text: 'Corrected first decision.',
      },
      {
        timestamp: '2026-01-02T12:00:00.000Z',
        text: 'Second decision.',
      },
    ]);
    expect(task.frontmatter.updated).not.toBe('2026-01-02T00:00:00.000Z');

    const reread = await listTasks(adapter, DEFAULT_CONFIG);
    expect(reread.tasks[0]).toMatchObject({
      body: 'Timeless description.',
      comments: task.comments,
    });
  });

  it('deletes only the selected entry and removes an empty Updates section', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/my-task.md': seededTask(),
    });

    const task = await deleteComment(adapter, DEFAULT_CONFIG, 'my-task', 0);

    expect(task.body).toBe('Timeless description.');
    expect(task.comments).toEqual([
      {
        timestamp: '2026-01-02T12:00:00.000Z',
        text: 'Second decision.',
      },
    ]);

    await deleteComment(adapter, DEFAULT_CONFIG, 'my-task', 0);
    const raw = adapter.files.get('.shipbench/tasks/my-task.md') ?? '';
    expect(raw).toContain('Timeless description.');
    expect(raw).not.toContain('## Task Updates');
  });

  it('rejects blank edits and out-of-range indices without changing the file', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/my-task.md': seededTask(),
    });
    const original = adapter.files.get('.shipbench/tasks/my-task.md');

    await expect(
      editComment(adapter, DEFAULT_CONFIG, 'my-task', 0, '   '),
    ).rejects.toThrow(/must not be blank/i);
    await expect(
      editComment(adapter, DEFAULT_CONFIG, 'my-task', 2, 'Nope.'),
    ).rejects.toThrow(/invalid task update index/i);
    await expect(
      deleteComment(adapter, DEFAULT_CONFIG, 'my-task', -1),
    ).rejects.toThrow(/invalid task update index/i);
    expect(adapter.files.get('.shipbench/tasks/my-task.md')).toBe(original);
  });

  it('rejects mutations when the Updates section is malformed', async () => {
    const malformed = taskFile(
      {
        title: 'My Task',
        status: 'todo',
        created: '2026-01-01T00:00:00.000Z',
        updated: '2026-01-02T00:00:00.000Z',
      },
      `Timeless description.

## Task Updates

### not-a-timestamp
Broken entry.`,
    );
    const adapter = memoryAdapter({
      '.shipbench/tasks/my-task.md': malformed,
    });

    await expect(
      editComment(adapter, DEFAULT_CONFIG, 'my-task', 0, 'Corrected.'),
    ).rejects.toThrow(/cannot edit an update.*malformed/i);
    await expect(
      deleteComment(adapter, DEFAULT_CONFIG, 'my-task', 0),
    ).rejects.toThrow(/cannot delete an update.*malformed/i);
    expect(adapter.files.get('.shipbench/tasks/my-task.md')).toBe(malformed);
  });
});

describe('moveTask', () => {
  it('updates the status without recording a done-column layout entry', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/my-task.md': taskFile({
        title: 'My Task',
        status: 'todo',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }),
    });
    const task = await moveTask(adapter, DEFAULT_CONFIG, 'my-task', 'done');
    expect(task.frontmatter.status).toBe('done');
    const layout = JSON.parse(
      adapter.files.get('.shipbench/layout.json') ?? '{}',
    );
    expect(layout).not.toHaveProperty('done');
  });

  it('appends a task moved out of done to the destination layout', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/my-task.md': taskFile({
        title: 'My Task',
        status: 'done',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }),
    });
    const config = {
      ...DEFAULT_CONFIG,
      layout: { done: ['my-task'], todo: [] },
    };

    const task = await moveTask(adapter, config, 'my-task', 'todo');

    expect(task.frontmatter.status).toBe('todo');
    const layout = JSON.parse(
      adapter.files.get('.shipbench/layout.json') ?? '{}',
    );
    expect(layout.todo).toEqual(['my-task']);
    expect(layout).not.toHaveProperty('done');
  });
});

describe('reorderTask', () => {
  function withSeed(seedConfig: Partial<ShipbenchConfig>) {
    return memoryAdapter({
      '.shipbench/tasks/a.md': taskFile({
        title: 'A',
        status: 'todo',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }),
      '.shipbench/tasks/b.md': taskFile({
        title: 'B',
        status: 'todo',
        created: '2026-01-02T00:00:00Z',
        updated: '2026-01-02T00:00:00Z',
      }),
      '.shipbench/tasks/c.md': taskFile({
        title: 'C',
        status: 'in-progress',
        created: '2026-01-03T00:00:00Z',
        updated: '2026-01-03T00:00:00Z',
      }),
      '.shipbench/config.json': `${JSON.stringify(
        { ...DEFAULT_CONFIG, ...seedConfig },
        null,
        2,
      )}\n`,
    });
  }

  it('places the task at the requested position when moving across columns', async () => {
    const adapter = withSeed({
      layout: { todo: ['a', 'b'], 'in-progress': ['c'] },
    });
    const config = {
      ...DEFAULT_CONFIG,
      layout: { todo: ['a', 'b'], 'in-progress': ['c'] },
    };

    const { task, layout } = await reorderTask(
      adapter,
      config,
      'a',
      'in-progress',
      0,
    );

    expect(task.frontmatter.status).toBe('in-progress');
    expect(layout['in-progress']).toEqual(['a', 'c']);
    expect(layout.todo).toEqual(['b']);
  });

  it('reorders within the same column without rewriting the task file', async () => {
    const adapter = withSeed({ layout: { todo: ['a', 'b'] } });
    const config = {
      ...DEFAULT_CONFIG,
      layout: { todo: ['a', 'b'] },
    };
    const originalTaskFile = adapter.files.get('.shipbench/tasks/a.md');

    const { layout } = await reorderTask(adapter, config, 'a', 'todo', 1);

    expect(layout.todo).toEqual(['b', 'a']);
    // Task file wasn't touched (no status change).
    expect(adapter.files.get('.shipbench/tasks/a.md')).toBe(originalTaskFile);
  });

  it('appends when position is -1', async () => {
    const adapter = withSeed({ layout: { todo: ['a', 'b'] } });
    const config = {
      ...DEFAULT_CONFIG,
      layout: { todo: ['a', 'b'] },
    };

    const { layout } = await reorderTask(adapter, config, 'a', 'todo', -1);

    expect(layout.todo).toEqual(['b', 'a']);
  });

  it('prunes stale slugs from any column it rewrites', async () => {
    const adapter = withSeed({
      layout: { todo: ['a', 'ghost', 'b'], 'in-progress': ['c', 'phantom'] },
    });
    const config = {
      ...DEFAULT_CONFIG,
      layout: { todo: ['a', 'ghost', 'b'], 'in-progress': ['c', 'phantom'] },
    };

    const { layout } = await reorderTask(
      adapter,
      config,
      'a',
      'in-progress',
      0,
    );

    expect(layout.todo).toEqual(['b']);
    expect(layout['in-progress']).toEqual(['a', 'c']);
  });

  it('eagerly prunes existing done-column layout entries', async () => {
    const adapter = withSeed({
      layout: { todo: ['a', 'b'], done: ['c'] },
    });
    const config = {
      ...DEFAULT_CONFIG,
      layout: { todo: ['a', 'b'], done: ['c'] },
    };

    const { layout } = await reorderTask(adapter, config, 'a', 'todo', 1);

    expect(layout.todo).toEqual(['b', 'a']);
    expect(layout).not.toHaveProperty('done');
    const written = JSON.parse(
      adapter.files.get('.shipbench/layout.json') ?? '{}',
    );
    expect(written).not.toHaveProperty('done');
  });

  it('treats a former done column as orderable after reassignment', async () => {
    const config = {
      ...DEFAULT_CONFIG,
      done_column: 'in-progress',
      layout: { todo: ['a', 'b'] },
    };
    const adapter = withSeed(config);

    const { layout } = await reorderTask(adapter, config, 'a', 'done', 0);

    expect(layout.done).toEqual(['a']);
    expect(layout).not.toHaveProperty('in-progress');
  });

  it('rejects an invalid destination status', async () => {
    const adapter = withSeed({});
    await expect(
      reorderTask(adapter, DEFAULT_CONFIG, 'a', 'nope', 0),
    ).rejects.toThrow(/invalid status/i);
  });

  it('materializes leftovers into layout before applying position', async () => {
    // Column layout only tracks 'a'. 'b' has status=todo but no layout entry
    // (a leftover). Visible column is [a, b] since b is a leftover sorted
    // by created desc. Reordering 'a' to position 2 should place it AFTER b,
    // producing visible [b, a] — not the pre-fix behavior where position 2
    // would clamp to layout length 1 and no-op.
    const adapter = withSeed({ layout: { todo: ['a'] } });
    const config = { ...DEFAULT_CONFIG, layout: { todo: ['a'] } };

    const { layout } = await reorderTask(adapter, config, 'a', 'todo', 2);

    expect(layout.todo).toEqual(['b', 'a']);
  });

  it('migrates a legacy config layout on the first layout write', async () => {
    const adapter = withSeed({ layout: { todo: ['a', 'b'] } });
    const config = {
      ...DEFAULT_CONFIG,
      layout: { todo: ['a', 'b'] },
    };

    await reorderTask(adapter, config, 'a', 'todo', 1);

    expect(
      JSON.parse(adapter.files.get('.shipbench/layout.json') ?? '{}'),
    ).toEqual({ todo: ['b', 'a'] });
    expect(
      JSON.parse(adapter.files.get('.shipbench/config.json') ?? '{}'),
    ).not.toHaveProperty('layout');
  });

  it('leaves modern config.json byte-identical on layout writes', async () => {
    const adapter = withSeed({});
    const { layout: _layout, ...modernConfig } = DEFAULT_CONFIG;
    const rawConfig = `${JSON.stringify(modernConfig)}\n`;
    adapter.files.set('.shipbench/config.json', rawConfig);
    adapter.files.set(
      '.shipbench/layout.json',
      `${JSON.stringify({ todo: ['a', 'b'] }, null, 2)}\n`,
    );
    const config = {
      ...DEFAULT_CONFIG,
      layout: { todo: ['a', 'b'] },
    };

    await reorderTask(adapter, config, 'a', 'todo', 1);

    expect(adapter.files.get('.shipbench/config.json')).toBe(rawConfig);
    expect(
      JSON.parse(adapter.files.get('.shipbench/layout.json') ?? '{}'),
    ).toEqual({ todo: ['b', 'a'] });
  });

  it('creates layout.json from fallback ordering when it is absent', async () => {
    const adapter = withSeed({});
    const { layout: _layout, ...modernConfig } = DEFAULT_CONFIG;
    const rawConfig = `${JSON.stringify(modernConfig, null, 2)}\n`;
    adapter.files.set('.shipbench/config.json', rawConfig);

    const { layout } = await reorderTask(
      adapter,
      { ...DEFAULT_CONFIG, layout: {} },
      'a',
      'todo',
      -1,
    );

    expect(layout.todo).toEqual(['b', 'a']);
    expect(adapter.files.get('.shipbench/config.json')).toBe(rawConfig);
    expect(adapter.files.has('.shipbench/layout.json')).toBe(true);
  });
});

describe('getTask', () => {
  it('directly reads and parses one live task with full fidelity', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/inspect-me.md': `---
title: Inspect me
status: in-progress
priority: high
tags: [core, query]
created: 2026-01-02T03:04:05.678Z
updated: 2026-02-03T04:05:06.789Z
---

# Details

Keep **all** of this.
`,
    });
    const readPaths: string[] = [];
    const baseReadFileIfExists = adapter.readFileIfExists;
    adapter.readFileIfExists = async path => {
      readPaths.push(path);
      return baseReadFileIfExists(path);
    };
    adapter.listFiles = async () => {
      throw new Error('getTask must not list the board');
    };

    const result = await getTask(adapter, DEFAULT_CONFIG, 'inspect-me');

    expect(readPaths).toEqual(['.shipbench/tasks/inspect-me.md']);
    expect(result).toEqual({
      slug: 'inspect-me',
      frontmatter: {
        title: 'Inspect me',
        status: 'in-progress',
        priority: 'high',
        tags: ['core', 'query'],
        created: '2026-01-02T03:04:05.678Z',
        updated: '2026-02-03T04:05:06.789Z',
      },
      body: '# Details\n\nKeep **all** of this.',
      comments: [],
    });
  });

  it('reads from the archive when requested', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/archive/archived-record.md': taskFile(
        {
          title: 'Archived record',
          status: 'done',
          priority: 'medium',
          created: '2026-01-01T00:00:00.000Z',
          updated: '2026-01-02T00:00:00.000Z',
        },
        'Archived body',
      ),
    });

    const result = await getTask(adapter, DEFAULT_CONFIG, 'archived-record', {
      archived: true,
    });

    expect(result).toEqual(
      expect.objectContaining({
        slug: 'archived-record',
        body: 'Archived body',
      }),
    );
  });

  it('returns null for live and archived misses', async () => {
    const adapter = memoryAdapter();

    await expect(
      getTask(adapter, DEFAULT_CONFIG, 'missing'),
    ).resolves.toBeNull();
    await expect(
      getTask(adapter, DEFAULT_CONFIG, 'missing', { archived: true }),
    ).resolves.toBeNull();
  });
});

describe('listTasks', () => {
  it('returns empty result for an empty tasks directory', async () => {
    const adapter = memoryAdapter();
    const result = await listTasks(adapter, DEFAULT_CONFIG);
    expect(result.tasks).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('returns timestamps as strings even when the file has bare (unquoted) ISO timestamps', async () => {
    // Hand-written / agent-written / init-written file — bare YAML timestamps.
    const handWritten = `---
title: Hand Written
status: todo
priority: medium
created: 2026-01-02T03:04:05.678Z
updated: 2026-01-02T03:04:05.678Z
---

body
`;
    const adapter = memoryAdapter({
      '.shipbench/tasks/hand-written.md': handWritten,
    });
    const result = await listTasks(adapter, DEFAULT_CONFIG);
    const fm = result.tasks[0].frontmatter;

    expect(typeof fm.created).toBe('string');
    expect(typeof fm.updated).toBe('string');
    expect(fm.created).toBe('2026-01-02T03:04:05.678Z');
    expect(fm.updated).toBe('2026-01-02T03:04:05.678Z');
  });

  it('warns about unknown status (does not drop the task)', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/orphan.md': taskFile({
        title: 'Orphan',
        status: 'mystery-column',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }),
    });
    const result = await listTasks(adapter, DEFAULT_CONFIG);
    expect(result.tasks).toHaveLength(1);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ slug: 'orphan', field: 'status' }),
    );
  });

  it('warns about unknown priority', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/p.md': taskFile({
        title: 'P',
        status: 'todo',
        priority: 'galactic',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }),
    });
    const result = await listTasks(adapter, DEFAULT_CONFIG);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ slug: 'p', field: 'priority' }),
    );
  });

  it('parses a trailing Updates section separately from the description', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/decision.md': taskFile(
        {
          title: 'Decision',
          status: 'todo',
          created: '2026-01-01T00:00:00Z',
          updated: '2026-01-01T00:00:00Z',
        },
        `Description only.

## Task Updates

### 2026-07-24T20:00:00Z
Raised priority after the customer call.

### 2026-07-25T09:30:00.000Z
Pivoted to the adapter approach.

- It preserves the storage boundary.
- It keeps Harbor read-only.`,
      ),
    });

    const result = await listTasks(adapter, DEFAULT_CONFIG);

    expect(result.warnings).toEqual([]);
    expect(result.tasks[0]).toMatchObject({
      body: 'Description only.',
      comments: [
        {
          timestamp: '2026-07-24T20:00:00Z',
          text: 'Raised priority after the customer call.',
        },
        {
          timestamp: '2026-07-25T09:30:00.000Z',
          text: `Pivoted to the adapter approach.

- It preserves the storage boundary.
- It keeps Harbor read-only.`,
        },
      ],
    });
  });

  it('warns about malformed Updates and preserves the raw Markdown in body', async () => {
    const malformedBody = `Description stays readable.

## Task Updates

### yesterday
This timestamp is malformed.`;
    const adapter = memoryAdapter({
      '.shipbench/tasks/malformed.md': taskFile(
        {
          title: 'Malformed',
          status: 'todo',
          created: '2026-01-01T00:00:00Z',
          updated: '2026-01-01T00:00:00Z',
        },
        malformedBody,
      ),
    });

    const result = await listTasks(adapter, DEFAULT_CONFIG);

    expect(result.tasks[0]).toMatchObject({
      body: malformedBody,
      comments: [],
    });
    expect(result.warnings).toContainEqual({
      slug: 'malformed',
      field: 'updates',
      message: expect.stringMatching(/malformed updates section/i),
    });
  });

  it('preserves malformed Updates during frontmatter-only edits', async () => {
    const malformedBody = `Description.

## Task Updates

Entry without a timestamp heading.`;
    const adapter = memoryAdapter({
      '.shipbench/tasks/malformed.md': taskFile(
        {
          title: 'Malformed',
          status: 'todo',
          priority: 'medium',
          created: '2026-01-01T00:00:00Z',
          updated: '2026-01-01T00:00:00Z',
        },
        malformedBody,
      ),
    });

    await updateTask(adapter, DEFAULT_CONFIG, 'malformed', {
      priority: 'high',
    });
    const reread = await listTasks(adapter, DEFAULT_CONFIG);

    expect(reread.tasks[0]!.body).toBe(malformedBody);
    expect(reread.warnings).toEqual([
      expect.objectContaining({ slug: 'malformed', field: 'updates' }),
    ]);
  });

  it('preserves unknown frontmatter fields and warns about them', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/x.md': taskFile({
        title: 'X',
        status: 'todo',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
        proirity: 'high', // typo — unknown field
        custom_thing: 42,
      }),
    });
    const result = await listTasks(adapter, DEFAULT_CONFIG);
    expect(result.tasks[0].frontmatter).toMatchObject({
      proirity: 'high',
      custom_thing: 42,
    } as Record<string, unknown>);
    expect(result.warnings.map(w => w.field)).toEqual(
      expect.arrayContaining(['proirity', 'custom_thing']),
    );
  });

  it('ignores non-markdown files in the tasks directory', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/.gitkeep': '',
      '.shipbench/tasks/notes.txt': 'not a task',
    });
    const result = await listTasks(adapter, DEFAULT_CONFIG);
    expect(result.tasks).toEqual([]);
  });

  it('does not read archived tasks or make an archive adapter call', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/live.md': taskFile({
        title: 'Live',
        status: 'todo',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }),
      '.shipbench/tasks/archive/archived.md': taskFile({
        title: 'Archived',
        status: 'done',
        created: '2025-01-01T00:00:00Z',
        updated: '2025-01-01T00:00:00Z',
      }),
    });
    const listedDirectories: string[] = [];
    const baseListFiles = adapter.listFiles;
    adapter.listFiles = async directory => {
      listedDirectories.push(directory);
      return baseListFiles(directory);
    };

    const result = await listTasks(adapter, DEFAULT_CONFIG);

    expect(result.tasks.map(task => task.slug)).toEqual(['live']);
    expect(listedDirectories).toEqual(['.shipbench/tasks']);
  });

  it('roundtrips body content', async () => {
    const adapter = memoryAdapter();
    await createTask(adapter, DEFAULT_CONFIG, 'My Task');
    await updateTask(
      adapter,
      DEFAULT_CONFIG,
      'my-task',
      {},
      'hello\n\n- one\n- two',
    );
    const result = await listTasks(adapter, DEFAULT_CONFIG);
    expect(result.tasks[0].body).toBe('hello\n\n- one\n- two');
  });

  it('returns valid tasks and warns when another task has malformed frontmatter', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/valid.md': taskFile({
        title: 'Valid',
        status: 'todo',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }),
      '.shipbench/tasks/broken.md': '---\ntitle: [unclosed\n---\n\nbody\n',
    });

    const result = await listTasks(adapter, DEFAULT_CONFIG);

    expect(result.tasks.map(task => task.slug)).toEqual(['valid']);
    expect(taskFileSlugs(result).sort()).toEqual(['broken', 'valid']);
    expect(result.warnings).toEqual([
      {
        slug: 'broken',
        field: 'frontmatter',
        message: expect.stringMatching(
          /could not parse frontmatter.*\.shipbench\/tasks\/broken\.md/i,
        ),
      },
    ]);
  });

  it('returns an empty task list and a warning when the only task is malformed', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/broken.md': '---\ntitle: [unclosed\n---\n\nbody\n',
    });

    const result = await listTasks(adapter, DEFAULT_CONFIG);

    expect(result.tasks).toEqual([]);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        slug: 'broken',
        field: 'frontmatter',
      }),
    ]);
  });

  it('warns every time it reads the same broken file', async () => {
    // gray-matter caches by content and files the entry *before* it parses, so
    // a YAML error leaves a poisoned entry behind. Without `clearCache`, the
    // second read of the same bytes succeeds with `{ data: {} }` — a task with
    // no title and no status, which is worse than the error it replaced.
    //
    // Reading twice is what a file watcher does. The terminal board re-reads on
    // every event, and a file still being written gets read more than once.
    const adapter = memoryAdapter({
      '.shipbench/tasks/broken.md': '---\ntitle: [unclosed\n---\n\nbody\n',
    });

    const first = await listTasks(adapter, DEFAULT_CONFIG);
    const second = await listTasks(adapter, DEFAULT_CONFIG);

    expect(first).toEqual(second);
    expect(second).toMatchObject({
      tasks: [],
      warnings: [{ slug: 'broken', field: 'frontmatter' }],
    });
  });

  it('still rejects a write to a task with malformed frontmatter', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/broken.md': '---\ntitle: [unclosed\n---\n\nbody\n',
    });

    await expect(
      updateTask(adapter, DEFAULT_CONFIG, 'broken', { priority: 'high' }),
    ).rejects.toThrow();
  });
});

describe('task archiving', () => {
  const original = `---
title: Preserve Me
status: todo
priority: medium
created: 2026-01-01T00:00:00.000Z
updated: 2026-02-02T00:00:00.000Z
custom_field: keep-this
---

Body with deliberate formatting.
`;

  it('round-trips a task byte-identically and restores its layout position', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/preserve-me.md': original,
    });
    const config = {
      ...DEFAULT_CONFIG,
      layout: { todo: ['preserve-me'] },
    };

    await archiveTask(adapter, config, 'preserve-me');

    expect(adapter.files.has('.shipbench/tasks/preserve-me.md')).toBe(false);
    expect(adapter.files.get('.shipbench/tasks/archive/preserve-me.md')).toBe(
      original,
    );
    expect(
      JSON.parse(adapter.files.get('.shipbench/layout.json') ?? '{}').todo,
    ).toEqual([]);

    await unarchiveTask(adapter, config, 'preserve-me');

    expect(adapter.files.get('.shipbench/tasks/preserve-me.md')).toBe(original);
    expect(adapter.files.has('.shipbench/tasks/archive/preserve-me.md')).toBe(
      false,
    );
    expect(
      JSON.parse(adapter.files.get('.shipbench/layout.json') ?? '{}').todo,
    ).toEqual(['preserve-me']);
  });

  it('lists archived tasks separately from live tasks', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/live.md': taskFile({
        title: 'Live',
        status: 'todo',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }),
      '.shipbench/tasks/archive/archived.md': taskFile({
        title: 'Archived',
        status: 'done',
        depends_on: ['live'],
        created: '2025-01-01T00:00:00Z',
        updated: '2025-01-01T00:00:00Z',
      }),
    });

    const archived = await listArchivedTasks(adapter, DEFAULT_CONFIG);

    expect(archived.tasks.map(task => task.slug)).toEqual(['archived']);
    expect(archived.warnings).toEqual([]);
  });

  it('returns valid archived tasks and warns about malformed archived files', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/archive/valid.md': taskFile({
        title: 'Valid',
        status: 'done',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }),
      '.shipbench/tasks/archive/broken.md':
        '---\ntitle: [unclosed\n---\n\nbody\n',
    });

    const result = await listArchivedTasks(adapter, DEFAULT_CONFIG);

    expect(result.tasks.map(task => task.slug)).toEqual(['valid']);
    expect(taskFileSlugs(result).sort()).toEqual(['broken', 'valid']);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        slug: 'broken',
        field: 'frontmatter',
        message: expect.stringMatching(
          /\.shipbench\/tasks\/archive\/broken\.md/i,
        ),
      }),
    ]);
  });

  it('archives a done task even when live tasks depend on it', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/finished.md': taskFile({
        title: 'Finished',
        status: 'done',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }),
      '.shipbench/tasks/dependent.md': taskFile({
        title: 'Dependent',
        status: 'todo',
        depends_on: ['finished'],
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }),
    });

    await expect(
      archiveTask(adapter, DEFAULT_CONFIG, 'finished'),
    ).resolves.toMatchObject({ slug: 'finished' });
  });

  it('archives a non-done task when it has no live dependents', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/abandoned.md': taskFile({
        title: 'Abandoned',
        status: 'todo',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }),
    });

    await expect(
      archiveTask(adapter, DEFAULT_CONFIG, 'abandoned'),
    ).resolves.toMatchObject({ slug: 'abandoned' });
  });

  it('blocks a non-done task with live dependents and lists their slugs', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/foundation.md': taskFile({
        title: 'Foundation',
        status: 'todo',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }),
      '.shipbench/tasks/zeta.md': taskFile({
        title: 'Zeta',
        status: 'todo',
        depends_on: ['foundation'],
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }),
      '.shipbench/tasks/alpha.md': taskFile({
        title: 'Alpha',
        status: 'in-progress',
        depends_on: ['foundation'],
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }),
    });

    const error = await archiveTask(
      adapter,
      DEFAULT_CONFIG,
      'foundation',
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ArchiveBlockedError);
    expect(error).toMatchObject({
      slug: 'foundation',
      dependentSlugs: ['alpha', 'zeta'],
    });
    expect(adapter.files.has('.shipbench/tasks/foundation.md')).toBe(true);
    expect(adapter.files.has('.shipbench/tasks/archive/foundation.md')).toBe(
      false,
    );
  });

  it('allows force to bypass the live-dependents guard', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/foundation.md': taskFile({
        title: 'Foundation',
        status: 'todo',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }),
      '.shipbench/tasks/dependent.md': taskFile({
        title: 'Dependent',
        status: 'todo',
        depends_on: ['foundation'],
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }),
    });

    await expect(
      archiveTask(adapter, DEFAULT_CONFIG, 'foundation', { force: true }),
    ).resolves.toMatchObject({ slug: 'foundation' });
  });

  it('does not add an unarchived done task to layout', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/archive/finished.md': taskFile({
        title: 'Finished',
        status: 'done',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }),
    });

    await unarchiveTask(adapter, DEFAULT_CONFIG, 'finished');

    expect(adapter.files.has('.shipbench/layout.json')).toBe(false);
  });
});

describe('deleteTask', () => {
  it('removes the file and prunes the slug from every column in layout', async () => {
    const adapter = memoryAdapter({
      '.shipbench/tasks/gone.md': taskFile({
        title: 'Gone',
        status: 'todo',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }),
      '.shipbench/tasks/stays.md': taskFile({
        title: 'Stays',
        status: 'todo',
        created: '2026-01-02T00:00:00Z',
        updated: '2026-01-02T00:00:00Z',
      }),
    });
    const config: ShipbenchConfig = {
      ...DEFAULT_CONFIG,
      layout: { todo: ['gone', 'stays'], done: ['gone'] },
    };

    await deleteTask(adapter, config, 'gone');

    expect(adapter.files.has('.shipbench/tasks/gone.md')).toBe(false);
    const persisted = JSON.parse(
      adapter.files.get('.shipbench/layout.json') ?? '{}',
    );
    expect(persisted.todo).toEqual(['stays']);
    expect(persisted).not.toHaveProperty('done');
  });
});

describe('depends_on', () => {
  function boardWith(...slugs: [string, string[]?][]) {
    const seed: Record<string, string> = {};
    for (const [slug, dependsOn] of slugs) {
      seed[`.shipbench/tasks/${slug}.md`] = taskFile({
        title: slug,
        status: 'todo',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
        ...(dependsOn ? { depends_on: dependsOn } : {}),
      });
    }
    return memoryAdapter(seed);
  }

  it('round-trips through create and read', async () => {
    const adapter = boardWith(['api'], ['schema']);

    const created = await createTask(adapter, DEFAULT_CONFIG, 'Wire it up', {
      depends_on: ['api', 'schema'],
    });
    expect(created.frontmatter.depends_on).toEqual(['api', 'schema']);

    const { tasks, warnings } = await listTasks(adapter, DEFAULT_CONFIG);
    const reread = tasks.find(t => t.slug === 'wire-it-up');
    expect(reread?.frontmatter.depends_on).toEqual(['api', 'schema']);
    expect(warnings).toEqual([]);
  });

  it('omits the field entirely when the dependency list is empty', async () => {
    const adapter = memoryAdapter();
    await createTask(adapter, DEFAULT_CONFIG, 'Standalone', { depends_on: [] });

    const raw = adapter.files.get('.shipbench/tasks/standalone.md');
    expect(raw).toBeDefined();
    expect(matter(raw!).data).not.toHaveProperty('depends_on');
  });

  it('rejects a dependency slug with no matching task file on write', async () => {
    const adapter = boardWith(['api']);
    await expect(
      createTask(adapter, DEFAULT_CONFIG, 'Wire it up', {
        depends_on: ['api', 'ghost'],
      }),
    ).rejects.toThrow(/unknown dependency "ghost"/i);
  });

  it('rejects a task that depends on itself', async () => {
    const adapter = boardWith(['api']);
    await expect(
      updateTask(adapter, DEFAULT_CONFIG, 'api', { depends_on: ['api'] }),
    ).rejects.toThrow(/cannot depend on itself/i);
  });

  it('rejects a direct two-hop cycle', async () => {
    const adapter = boardWith(['api', ['schema']], ['schema']);
    await expect(
      updateTask(adapter, DEFAULT_CONFIG, 'schema', { depends_on: ['api'] }),
    ).rejects.toThrow(/cycle: "api" already depends on "schema"/i);
  });

  it('warns about a dangling dependency on read without dropping the task', async () => {
    const adapter = boardWith(['wire-it-up', ['deleted-task']]);

    const { tasks, warnings } = await listTasks(adapter, DEFAULT_CONFIG);

    expect(tasks.map(t => t.slug)).toEqual(['wire-it-up']);
    expect(warnings).toEqual([
      {
        slug: 'wire-it-up',
        field: 'depends_on',
        message: expect.stringMatching(
          /dangling dependency "deleted-task".*no live task file.*may be archived/i,
        ),
      },
    ]);
  });

  it('does not warn when a dependency resolves to an archived task file', async () => {
    const adapter = boardWith(['wire-it-up', ['archived-task']]);
    adapter.files.set(
      '.shipbench/tasks/archive/archived-task.md',
      taskFile({
        title: 'Archived task',
        status: 'done',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
      }),
    );

    const archived = await listArchivedTasks(adapter, DEFAULT_CONFIG);
    const { tasks, warnings } = await listTasks(adapter, DEFAULT_CONFIG, {
      archivedSlugs: taskFileSlugs(archived),
    });

    expect(tasks.map(task => task.slug)).toEqual(['wire-it-up']);
    expect(warnings).toEqual([]);
  });

  it('does not treat a dependency on a malformed-but-present file as dangling', async () => {
    const adapter = boardWith(['wire-it-up', ['broken']]);
    adapter.files.set(
      '.shipbench/tasks/broken.md',
      '---\ntitle: [unclosed\n---\n\nbody\n',
    );

    const { tasks, warnings } = await listTasks(adapter, DEFAULT_CONFIG);

    expect(tasks.map(t => t.slug)).toEqual(['wire-it-up']);
    expect(warnings).toEqual([
      expect.objectContaining({ slug: 'broken', field: 'frontmatter' }),
    ]);
  });

  it('clears the field when update passes an empty list', async () => {
    const adapter = boardWith(['api'], ['wire-it-up', ['api']]);

    const { task: updated } = await updateTask(
      adapter,
      DEFAULT_CONFIG,
      'wire-it-up',
      {
        depends_on: [],
      },
    );

    expect(updated.frontmatter.depends_on).toBeUndefined();
    const raw = adapter.files.get('.shipbench/tasks/wire-it-up.md');
    expect(matter(raw!).data).not.toHaveProperty('depends_on');
  });

  it('leaves an existing field untouched when update omits it', async () => {
    const adapter = boardWith(['api'], ['wire-it-up', ['api']]);

    const { task: updated } = await updateTask(
      adapter,
      DEFAULT_CONFIG,
      'wire-it-up',
      {
        priority: 'high',
      },
    );

    expect(updated.frontmatter.depends_on).toEqual(['api']);
  });
});
