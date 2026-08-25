import type { BoardAPI, ShipbenchConfig, Task } from '@shipbench/core';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';
import { createBoardStore, getVisibleTasks } from './boardStore.js';

const config: ShipbenchConfig = {
  version: 1,
  name: 'Test Project',
  columns: [
    { id: 'todo', label: 'To Do' },
    { id: 'done', label: 'Done' },
  ],
  default_column: 'todo',
  done_column: 'done',
  done_display: { max: 20 },
  priority: {
    values: ['low', 'medium', 'high'],
    default: 'medium',
  },
  schema: {
    custom_fields: {},
  },
  layout: {},
};

const task = (overrides: Partial<Task> = {}): Task => ({
  slug: 'setup-auth',
  frontmatter: {
    title: 'Setup auth',
    status: 'todo',
    priority: 'medium',
    assignee: 'Trinity',
    tags: ['auth'],
    created: '2026-06-01T00:00:00.000Z',
    updated: '2026-06-01T00:00:00.000Z',
  },
  body: 'Body',
  comments: [],
  ...overrides,
});

function api(overrides: Partial<BoardAPI> = {}): BoardAPI {
  return {
    getConfig: vi.fn(async () => config),
    listTasks: vi.fn(async () => ({ tasks: [task()], warnings: [] })),
    listArchivedTasks: vi.fn(async () => ({ tasks: [], warnings: [] })),
    createTask: vi.fn(async (title, fields) =>
      task({
        slug: 'created-task',
        frontmatter: {
          ...task().frontmatter,
          ...fields,
          title,
        },
        body: '',
      }),
    ),
    updateTask: vi.fn(async (slug, fields, body) => ({
      task: task({
        slug,
        frontmatter: { ...task().frontmatter, ...fields },
        body: body ?? task().body,
      }),
    })),
    addComment: vi.fn(async (slug, text) =>
      task({
        slug,
        comments: [
          {
            timestamp: '2026-06-01T01:00:00.000Z',
            text,
          },
        ],
      }),
    ),
    editComment: vi.fn(async (slug, _index, text) =>
      task({
        slug,
        comments: [
          {
            timestamp: '2026-06-01T01:00:00.000Z',
            text,
          },
        ],
      }),
    ),
    deleteComment: vi.fn(async slug => task({ slug, comments: [] })),
    moveTask: vi.fn(async (slug, toStatus) =>
      task({
        slug,
        frontmatter: { ...task().frontmatter, status: toStatus },
      }),
    ),
    reorderTask: vi.fn(async (slug, toStatus) => ({
      task: task({
        slug,
        frontmatter: { ...task().frontmatter, status: toStatus },
      }),
      layout: toStatus === config.done_column ? {} : { [toStatus]: [slug] },
    })),
    archiveTask: vi.fn(async () => undefined),
    unarchiveTask: vi.fn(async slug => task({ slug })),
    deleteTask: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('createBoardStore', () => {
  it('loads config, tasks, warnings, and sync metadata', async () => {
    const warning = {
      slug: 'setup-auth',
      field: 'status',
      message: 'Unknown status',
    };
    const store = createBoardStore(
      api({
        listTasks: vi.fn(async () => ({
          tasks: [task()],
          warnings: [warning],
        })),
      }),
    );

    await store.getState().refresh();

    expect(store.getState().config).toEqual(config);
    expect(store.getState().tasks).toHaveLength(1);
    expect(store.getState().warnings).toEqual([warning]);
    expect(store.getState().hasLoaded).toBe(true);
    expect(store.getState().lastSyncedAt).toEqual(expect.any(Number));
  });

  it('loads archived tasks only on first open and removes restored tasks', async () => {
    const archived = task({
      slug: 'filed-task',
      frontmatter: {
        ...task().frontmatter,
        title: 'Filed task',
        status: 'done',
      },
    });
    const listArchivedTasks = vi.fn(async () => ({
      tasks: [archived],
      warnings: [],
    }));
    const unarchiveTask = vi.fn(async () => archived);
    const store = createBoardStore(api({ listArchivedTasks, unarchiveTask }));

    await store.getState().refresh();
    expect(listArchivedTasks).not.toHaveBeenCalled();

    store.getState().openArchive();
    await vi.waitFor(() => {
      expect(store.getState().archivedTasks).toEqual([archived]);
    });
    expect(listArchivedTasks).toHaveBeenCalledTimes(1);
    expect(store.getState().archiveViewOpen).toBe(true);

    store.getState().closeArchive();
    store.getState().openArchive();
    expect(listArchivedTasks).toHaveBeenCalledTimes(1);

    await store.getState().unarchiveTask('filed-task');
    expect(store.getState().archivedTasks).toEqual([]);
    expect(store.getState().tasks[0]).toEqual(archived);
  });

  it('never opens or fetches the archive in read-only mode', async () => {
    const listArchivedTasks = vi.fn();
    const store = createBoardStore(api({ readOnly: true, listArchivedTasks }));

    store.getState().openArchive();
    await store.getState().loadArchivedTasks();

    expect(store.getState().archiveViewOpen).toBe(false);
    expect(listArchivedTasks).not.toHaveBeenCalled();
  });

  it('optimistically moves a task into done without recording layout', async () => {
    let resolveReorder!: (value: {
      task: Task;
      layout: Record<string, string[]>;
    }) => void;
    const boardApi = api({
      getConfig: vi.fn(async () => ({
        ...config,
        layout: { done: ['legacy-entry'] },
      })),
      reorderTask: vi.fn(
        () =>
          new Promise<{
            task: Task;
            layout: Record<string, string[]>;
          }>(resolve => {
            resolveReorder = resolve;
          }),
      ),
    });
    const store = createBoardStore(boardApi);
    await store.getState().refresh();

    const move = store.getState().moveTask('setup-auth', 'done');

    expect(boardApi.reorderTask).toHaveBeenCalledWith('setup-auth', 'done', -1);
    expect(store.getState().tasks[0]?.frontmatter.status).toBe('done');
    expect(store.getState().config?.layout).not.toHaveProperty('done');

    resolveReorder({
      task: task({
        frontmatter: { ...task().frontmatter, status: 'done' },
      }),
      layout: {},
    });
    await move;

    expect(store.getState().tasks[0]?.frontmatter.status).toBe('done');
    expect(store.getState().config?.layout).not.toHaveProperty('done');
  });

  it('reorders a task within the same column without changing status', async () => {
    const boardApi = api({
      reorderTask: vi.fn(async (slug, toStatus) => ({
        task: task({
          slug,
          frontmatter: { ...task().frontmatter, status: toStatus },
        }),
        layout: { todo: ['other', slug] },
      })),
      listTasks: vi.fn(async () => ({
        tasks: [task({ slug: 'other' }), task({ slug: 'setup-auth' })],
        warnings: [],
      })),
      getConfig: vi.fn(async () => ({
        ...config,
        layout: { todo: ['other', 'setup-auth'] },
      })),
    });
    const store = createBoardStore(boardApi);
    await store.getState().refresh();

    await store.getState().reorderTask('setup-auth', 'todo', 0);

    expect(boardApi.reorderTask).toHaveBeenCalledWith('setup-auth', 'todo', 0);
    expect(store.getState().config?.layout.todo).toEqual([
      'other',
      'setup-auth',
    ]);
  });

  it('rolls back both task status AND layout on a failed reorder', async () => {
    const store = createBoardStore(
      api({
        reorderTask: vi.fn(async () => {
          throw new Error('Nope');
        }),
      }),
    );
    await store.getState().refresh();

    await store.getState().moveTask('setup-auth', 'done');

    expect(store.getState().tasks[0]?.frontmatter.status).toBe('todo');
    expect(store.getState().config?.layout).toEqual({});
    expect(store.getState().errorAtBySlug['setup-auth']).toEqual(
      expect.any(Number),
    );
  });

  it('removes the deleted slug from optimistic layout', async () => {
    const boardApi = api({
      getConfig: vi.fn(async () => ({
        ...config,
        layout: { todo: ['setup-auth'] },
      })),
    });
    const store = createBoardStore(boardApi);
    await store.getState().refresh();

    await store.getState().deleteTask('setup-auth');

    expect(store.getState().config?.layout.todo).toEqual([]);
  });

  it('optimistically archives a task and exposes an Undo toast action', async () => {
    let resolveArchive: (() => void) | undefined;
    const archiveTask = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveArchive = resolve;
        }),
    );
    const unarchiveTask = vi.fn(async slug => task({ slug }));
    const reorderTask = vi.fn(async (slug, toStatus, _position) => ({
      task: task({
        slug,
        frontmatter: { ...task().frontmatter, status: toStatus },
      }),
      layout: { [toStatus]: ['first-task', slug, 'last-task'] },
    }));
    const toastSuccess = vi.spyOn(toast, 'success');
    const boardApi = api({
      archiveTask,
      unarchiveTask,
      reorderTask,
      getConfig: vi.fn(async () => ({
        ...config,
        layout: { todo: ['first-task', 'setup-auth', 'last-task'] },
      })),
      listTasks: vi.fn(async () => ({
        tasks: [
          task({ slug: 'first-task' }),
          task({ slug: 'setup-auth' }),
          task({ slug: 'last-task' }),
        ],
        warnings: [],
      })),
    });
    const store = createBoardStore(boardApi);
    await store.getState().refresh();
    store.getState().selectTask('setup-auth');

    const archive = store.getState().archiveTask('setup-auth');

    expect(store.getState().tasks.map(item => item.slug)).toEqual([
      'first-task',
      'last-task',
    ]);
    expect(store.getState().selectedTaskSlug).toBeNull();
    expect(store.getState().config?.layout.todo).toEqual([
      'first-task',
      'last-task',
    ]);
    expect(archiveTask).toHaveBeenCalledWith('setup-auth', undefined);

    resolveArchive?.();
    await archive;

    expect(toastSuccess).toHaveBeenCalledWith(
      'Task archived',
      expect.objectContaining({
        description: 'Setup auth',
        action: expect.objectContaining({ label: 'Undo' }),
      }),
    );
    const options = toastSuccess.mock.calls[0]?.[1] as
      | { action?: { onClick?: () => void } }
      | undefined;
    options?.action?.onClick?.();

    await vi.waitFor(() => {
      expect(unarchiveTask).toHaveBeenCalledWith('setup-auth');
      expect(reorderTask).toHaveBeenCalledWith('setup-auth', 'todo', 1);
      expect(store.getState().tasks.map(item => item.slug)).toContain(
        'setup-auth',
      );
      expect(store.getState().config?.layout.todo).toEqual([
        'first-task',
        'setup-auth',
        'last-task',
      ]);
    });
  });

  it('passes force through and rolls back a rejected archive', async () => {
    const toastError = vi.spyOn(toast, 'error');
    const boardApi = api({
      archiveTask: vi.fn(async () => {
        throw new Error('New dependent appeared.');
      }),
    });
    const store = createBoardStore(boardApi);
    await store.getState().refresh();
    store.getState().selectTask('setup-auth');

    await store.getState().archiveTask('setup-auth', true);

    expect(boardApi.archiveTask).toHaveBeenCalledWith('setup-auth', {
      force: true,
    });
    expect(store.getState().tasks.map(item => item.slug)).toContain(
      'setup-auth',
    );
    expect(store.getState().selectedTaskSlug).toBe('setup-auth');
    expect(toastError).toHaveBeenCalledWith(
      'Archive failed: New dependent appeared.',
    );
  });

  it('replaces temporary created tasks with authoritative API tasks', async () => {
    const store = createBoardStore(api());
    await store.getState().refresh();

    await store.getState().createTask('Created task', { status: 'todo' });

    expect(store.getState().tasks.map(item => item.slug)).toContain(
      'created-task',
    );
    expect(
      store.getState().tasks.some(item => item.slug.startsWith('new-')),
    ).toBe(false);
    // Creating a task should NOT auto-select it — user opens it manually.
    expect(store.getState().selectedTaskSlug).toBeNull();
  });

  it('optimistically appends a task update, then reconciles its timestamp', async () => {
    let resolveAddComment: ((value: Task) => void) | undefined;
    const authoritative = task({
      frontmatter: {
        ...task().frontmatter,
        updated: '2026-06-01T02:00:00.000Z',
      },
      comments: [
        {
          timestamp: '2026-06-01T02:00:00.000Z',
          text: 'Scope changed after review.',
        },
      ],
    });
    const addComment = vi.fn(
      () =>
        new Promise<Task>(resolve => {
          resolveAddComment = resolve;
        }),
    );
    const store = createBoardStore(api({ addComment }));
    await store.getState().refresh();

    const add = store
      .getState()
      .addComment('setup-auth', 'Scope changed after review.');

    expect(addComment).toHaveBeenCalledWith(
      'setup-auth',
      'Scope changed after review.',
    );
    expect(store.getState().tasks[0]?.comments.at(-1)?.text).toBe(
      'Scope changed after review.',
    );

    resolveAddComment?.(authoritative);
    await expect(add).resolves.toBe(true);

    expect(store.getState().tasks[0]).toEqual(authoritative);
  });

  it('rolls back a rejected task update and reports the failure', async () => {
    const toastError = vi.spyOn(toast, 'error');
    const store = createBoardStore(
      api({
        addComment: vi.fn(async () => {
          throw new Error('Task file is malformed.');
        }),
      }),
    );
    await store.getState().refresh();

    await expect(
      store.getState().addComment('setup-auth', 'Scope changed after review.'),
    ).resolves.toBe(false);

    expect(store.getState().tasks[0]?.comments).toEqual([]);
    expect(toastError).toHaveBeenCalledWith(
      'Task update failed: Task file is malformed.',
    );
  });

  it('optimistically edits task update text, preserves its timestamp, and reconciles', async () => {
    const original = task({
      comments: [
        {
          timestamp: '2026-06-01T01:00:00.000Z',
          text: 'Original decision.',
        },
      ],
    });
    const authoritative = task({
      frontmatter: {
        ...task().frontmatter,
        updated: '2026-06-01T02:00:00.000Z',
      },
      comments: [
        {
          timestamp: '2026-06-01T01:00:00.000Z',
          text: 'Corrected decision.',
        },
      ],
    });
    let resolveEditComment: ((value: Task) => void) | undefined;
    const editComment = vi.fn(
      () =>
        new Promise<Task>(resolve => {
          resolveEditComment = resolve;
        }),
    );
    const store = createBoardStore(
      api({
        listTasks: vi.fn(async () => ({ tasks: [original], warnings: [] })),
        editComment,
      }),
    );
    await store.getState().refresh();

    const edit = store
      .getState()
      .editComment('setup-auth', 0, 'Corrected decision.');

    expect(editComment).toHaveBeenCalledWith(
      'setup-auth',
      0,
      'Corrected decision.',
    );
    expect(store.getState().tasks[0]?.comments[0]).toEqual({
      timestamp: '2026-06-01T01:00:00.000Z',
      text: 'Corrected decision.',
    });

    resolveEditComment?.(authoritative);
    await expect(edit).resolves.toBe(true);
    expect(store.getState().tasks[0]).toEqual(authoritative);
  });

  it('optimistically deletes a task update and reconciles', async () => {
    const original = task({
      comments: [
        {
          timestamp: '2026-06-01T01:00:00.000Z',
          text: 'Wrong decision.',
        },
      ],
    });
    const authoritative = task({ comments: [] });
    let resolveDeleteComment: ((value: Task) => void) | undefined;
    const deleteComment = vi.fn(
      () =>
        new Promise<Task>(resolve => {
          resolveDeleteComment = resolve;
        }),
    );
    const store = createBoardStore(
      api({
        listTasks: vi.fn(async () => ({ tasks: [original], warnings: [] })),
        deleteComment,
      }),
    );
    await store.getState().refresh();

    const deletion = store.getState().deleteComment('setup-auth', 0);

    expect(deleteComment).toHaveBeenCalledWith('setup-auth', 0);
    expect(store.getState().tasks[0]?.comments).toEqual([]);

    resolveDeleteComment?.(authoritative);
    await expect(deletion).resolves.toBe(true);
    expect(store.getState().tasks[0]).toEqual(authoritative);
  });

  it('rolls back rejected task update edits and deletes', async () => {
    const toastError = vi.spyOn(toast, 'error');
    const original = task({
      comments: [
        {
          timestamp: '2026-06-01T01:00:00.000Z',
          text: 'Original decision.',
        },
      ],
    });
    const store = createBoardStore(
      api({
        listTasks: vi.fn(async () => ({ tasks: [original], warnings: [] })),
        editComment: vi.fn(async () => {
          throw new Error('Edit rejected.');
        }),
        deleteComment: vi.fn(async () => {
          throw new Error('Delete rejected.');
        }),
      }),
    );
    await store.getState().refresh();

    await expect(
      store.getState().editComment('setup-auth', 0, 'Corrected decision.'),
    ).resolves.toBe(false);
    expect(store.getState().tasks[0]).toEqual(original);
    expect(toastError).toHaveBeenCalledWith(
      'Task update edit failed: Edit rejected.',
    );

    await expect(store.getState().deleteComment('setup-auth', 0)).resolves.toBe(
      false,
    );
    expect(store.getState().tasks[0]).toEqual(original);
    expect(toastError).toHaveBeenCalledWith(
      'Task update delete failed: Delete rejected.',
    );
  });

  it('rolls back a rejected dependency edit and preserves a legible error', async () => {
    const toastError = vi.spyOn(toast, 'error');
    const boardApi = api({
      updateTask: vi.fn(async () => {
        throw new Error('Unknown dependency "ghost-task".');
      }),
    });
    const store = createBoardStore(boardApi);
    await store.getState().refresh();

    await store
      .getState()
      .updateTask('setup-auth', { depends_on: ['ghost-task'] });

    expect(store.getState().tasks[0]?.frontmatter.depends_on).toBeUndefined();
    expect(store.getState().errorAtBySlug['setup-auth']).toEqual(
      expect.any(Number),
    );
    expect(toastError).toHaveBeenCalledWith(
      'Update failed: Unknown dependency "ghost-task".',
    );
  });

  it('optimistically creates tasks in config.default_column when status is omitted', async () => {
    let resolveCreate:
      | ((value: Awaited<ReturnType<BoardAPI['createTask']>>) => void)
      | undefined;
    const boardApi = api({
      getConfig: vi.fn(async () => ({
        ...config,
        columns: [
          { id: 'blocked', label: 'Blocked' },
          { id: 'todo', label: 'To Do' },
        ],
        default_column: 'todo',
      })),
      createTask: vi.fn(
        () =>
          new Promise<Task>(resolve => {
            resolveCreate = resolve;
          }),
      ),
    });
    const store = createBoardStore(boardApi);
    await store.getState().refresh();

    const createPromise = store.getState().createTask('Created task');
    const optimistic = store
      .getState()
      .tasks.find(item => item.slug.startsWith('new-'));
    expect(optimistic?.frontmatter.status).toBe('todo');

    resolveCreate?.(
      task({
        slug: 'created-task',
        frontmatter: {
          ...task().frontmatter,
          title: 'Created task',
          status: 'todo',
        },
      }),
    );
    await createPromise;
  });
});

describe('getVisibleTasks', () => {
  it('matches title, slug, assignee, and tags case-insensitively', () => {
    const tasks = [
      task(),
      task({
        slug: 'write-docs',
        frontmatter: {
          ...task().frontmatter,
          title: 'Write docs',
          assignee: 'Ada',
          tags: ['docs'],
        },
      }),
    ];

    expect(getVisibleTasks(tasks, 'AUTH')).toHaveLength(1);
    expect(getVisibleTasks(tasks, 'ada')).toHaveLength(1);
    expect(getVisibleTasks(tasks, 'write-docs')).toHaveLength(1);
    expect(getVisibleTasks(tasks, 'missing')).toHaveLength(0);
  });

  describe('status changes via updateTask', () => {
    it('sends the full fields (including status) in a single updateTask call and applies the returned layout', async () => {
      const customConfig: ShipbenchConfig = {
        ...config,
        columns: [
          { id: 'todo', label: 'To Do' },
          { id: 'in-progress', label: 'In Progress' },
        ],
        layout: { todo: ['setup-auth', 'other-task'] },
      };
      const boardApi = api({
        getConfig: vi.fn(async () => customConfig),
        listTasks: vi.fn(async () => ({ tasks: [task()], warnings: [] })),
        updateTask: vi.fn(async (slug, fields) => ({
          task: task({
            slug,
            frontmatter: { ...task().frontmatter, ...fields },
          }),
          layout: { todo: ['other-task'], 'in-progress': [slug] },
        })),
      });
      const store = createBoardStore(boardApi);
      await store.getState().refresh();

      await store
        .getState()
        .updateTask('setup-auth', { status: 'in-progress' });

      expect(boardApi.updateTask).toHaveBeenCalledTimes(1);
      expect(boardApi.updateTask).toHaveBeenCalledWith(
        'setup-auth',
        { status: 'in-progress' },
        undefined,
      );
      expect(boardApi.reorderTask).not.toHaveBeenCalled();
      expect(store.getState().config?.layout).toEqual({
        todo: ['other-task'],
        'in-progress': ['setup-auth'],
      });
      expect(store.getState().tasks[0]?.frontmatter.status).toBe('in-progress');
    });

    it('applies the authoritative layout for a combined status + field update in one call', async () => {
      const customConfig: ShipbenchConfig = {
        ...config,
        columns: [
          { id: 'todo', label: 'To Do' },
          { id: 'in-progress', label: 'In Progress' },
        ],
        layout: { todo: ['setup-auth'] },
      };
      const saved = task({
        slug: 'setup-auth',
        frontmatter: {
          ...task().frontmatter,
          status: 'in-progress',
          title: 'New Title',
        },
        body: 'New Body',
      });
      const boardApi = api({
        getConfig: vi.fn(async () => customConfig),
        listTasks: vi.fn(async () => ({ tasks: [task()], warnings: [] })),
        updateTask: vi.fn(async () => ({
          task: saved,
          layout: { 'in-progress': ['setup-auth'] },
        })),
      });
      const store = createBoardStore(boardApi);
      await store.getState().refresh();

      await store
        .getState()
        .updateTask(
          'setup-auth',
          { status: 'in-progress', title: 'New Title' },
          'New Body',
        );

      expect(boardApi.updateTask).toHaveBeenCalledTimes(1);
      expect(boardApi.updateTask).toHaveBeenCalledWith(
        'setup-auth',
        { status: 'in-progress', title: 'New Title' },
        'New Body',
      );
      expect(boardApi.reorderTask).not.toHaveBeenCalled();
      expect(store.getState().tasks[0]).toBe(saved);
      expect(store.getState().config?.layout).toEqual({
        'in-progress': ['setup-auth'],
      });
    });

    it('rolls back status and layout when the update fails', async () => {
      const toastError = vi.spyOn(toast, 'error');
      const customConfig: ShipbenchConfig = {
        ...config,
        columns: [
          { id: 'todo', label: 'To Do' },
          { id: 'in-progress', label: 'In Progress' },
        ],
        layout: { todo: ['setup-auth'] },
      };
      const boardApi = api({
        getConfig: vi.fn(async () => customConfig),
        listTasks: vi.fn(async () => ({ tasks: [task()], warnings: [] })),
        updateTask: vi.fn(async () => {
          throw new Error('Unknown dependency "ghost-task".');
        }),
      });
      const store = createBoardStore(boardApi);
      await store.getState().refresh();

      await store.getState().updateTask('setup-auth', {
        status: 'in-progress',
        depends_on: ['ghost-task'],
      });

      // Single call carries the whole edit; on failure nothing partially
      // persists, and the optimistic status + layout roll back together.
      expect(boardApi.updateTask).toHaveBeenCalledTimes(1);
      expect(boardApi.updateTask).toHaveBeenCalledWith(
        'setup-auth',
        { status: 'in-progress', depends_on: ['ghost-task'] },
        undefined,
      );
      expect(store.getState().tasks[0]?.frontmatter.status).toBe('todo');
      expect(store.getState().config?.layout).toEqual({ todo: ['setup-auth'] });
      expect(toastError).toHaveBeenCalledWith(
        'Update failed: Unknown dependency "ghost-task".',
      );
    });

    it('moving to done applies a layout with no done entry', async () => {
      const customConfig: ShipbenchConfig = {
        ...config,
        columns: [
          { id: 'todo', label: 'To Do' },
          { id: 'done', label: 'Done' },
        ],
        layout: { todo: ['setup-auth', 'other-task'] },
      };
      const boardApi = api({
        getConfig: vi.fn(async () => customConfig),
        listTasks: vi.fn(async () => ({ tasks: [task()], warnings: [] })),
        updateTask: vi.fn(async (slug, fields) => ({
          task: task({
            slug,
            frontmatter: { ...task().frontmatter, ...fields },
          }),
          layout: { todo: ['other-task'] },
        })),
      });
      const store = createBoardStore(boardApi);
      await store.getState().refresh();

      await store.getState().updateTask('setup-auth', { status: 'done' });

      expect(boardApi.updateTask).toHaveBeenCalledWith(
        'setup-auth',
        { status: 'done' },
        undefined,
      );
      expect(boardApi.reorderTask).not.toHaveBeenCalled();
      expect(store.getState().config?.layout).toEqual({
        todo: ['other-task'],
      });
      expect(store.getState().config?.layout?.done).toBeUndefined();
    });
  });
});

describe('request sequencing', () => {
  const statusOf = (store: ReturnType<typeof createBoardStore>, slug: string) =>
    store.getState().tasks.find(t => t.slug === slug)?.frontmatter.status;

  const seed = (slug: string, status = 'todo') =>
    task({ slug, frontmatter: { ...task().frontmatter, status } });

  /** A reorderTask mock whose promises the test settles by hand. */
  function deferredReorder() {
    const settles: Array<{
      resolve: (value: {
        task: Task;
        layout: Record<string, string[]>;
      }) => void;
      reject: (error: unknown) => void;
    }> = [];
    const fn = vi.fn(
      () =>
        new Promise<{ task: Task; layout: Record<string, string[]> }>(
          (resolve, reject) => {
            settles.push({ resolve, reject });
          },
        ),
    );
    return { fn, settles };
  }

  it('does not let a refresh revert a move that is still in flight', async () => {
    const { fn, settles } = deferredReorder();
    const store = createBoardStore(
      api({
        listTasks: vi.fn(async () => ({
          tasks: [seed('a'), seed('b')],
          warnings: [],
        })),
        reorderTask: fn as unknown as BoardAPI['reorderTask'],
      }),
    );
    await store.getState().refresh();

    const moving = store.getState().reorderTask('a', 'done', -1);
    expect(statusOf(store, 'a')).toBe('done');

    // The CLI's file watcher fires from this very write, so a refresh lands
    // whose server read predates it. It must not drag the card backwards.
    await store.getState().refresh();
    expect(statusOf(store, 'a')).toBe('done');

    settles[0]?.resolve({
      task: seed('a', 'done'),
      layout: { todo: ['b'] },
    });
    await moving;
    expect(statusOf(store, 'a')).toBe('done');
    expect(store.getState().config?.layout).toEqual({ todo: ['b'] });
  });

  it('does not let a refresh resurrect a task whose delete is in flight', async () => {
    let settle: (() => void) | undefined;
    const store = createBoardStore(
      api({
        listTasks: vi.fn(async () => ({
          tasks: [seed('a'), seed('b')],
          warnings: [],
        })),
        deleteTask: vi.fn(
          () =>
            new Promise<void>(resolve => {
              settle = resolve;
            }),
        ),
      }),
    );
    await store.getState().refresh();

    const deleting = store.getState().deleteTask('a');
    expect(store.getState().tasks.map(t => t.slug)).toEqual(['b']);

    await store.getState().refresh();
    expect(store.getState().tasks.map(t => t.slug)).toEqual(['b']);

    settle?.();
    await deleting;
    expect(store.getState().tasks.map(t => t.slug)).toEqual(['b']);
  });

  it('still applies external edits to unrelated slugs while one is pending', async () => {
    const { fn, settles } = deferredReorder();
    let listing = [seed('a'), seed('b')];
    const store = createBoardStore(
      api({
        listTasks: vi.fn(async () => ({ tasks: listing, warnings: [] })),
        reorderTask: fn as unknown as BoardAPI['reorderTask'],
      }),
    );
    await store.getState().refresh();

    const moving = store.getState().reorderTask('a', 'done', -1);

    // Someone edits b in the editor while a's move is in flight.
    listing = [seed('a'), seed('b', 'done')];
    await store.getState().refresh();

    expect(statusOf(store, 'a')).toBe('done'); // pending — local wins
    expect(statusOf(store, 'b')).toBe('done'); // unrelated — server wins

    settles[0]?.resolve({ task: seed('a', 'done'), layout: {} });
    await moving;
  });

  it('applies a refresh normally once the mutation has settled', async () => {
    const { fn, settles } = deferredReorder();
    const store = createBoardStore(
      api({
        listTasks: vi.fn(async () => ({ tasks: [seed('a')], warnings: [] })),
        reorderTask: fn as unknown as BoardAPI['reorderTask'],
      }),
    );
    await store.getState().refresh();

    const moving = store.getState().reorderTask('a', 'done', -1);
    settles[0]?.resolve({ task: seed('a', 'done'), layout: {} });
    await moving;

    // Nothing pending now, so an external edit must come through.
    await store.getState().refresh();
    expect(statusOf(store, 'a')).toBe('todo');
  });

  it('re-reads once a suppressed refresh’s mutation settles', async () => {
    const { fn, settles } = deferredReorder();
    let listing = [seed('a'), seed('b')];
    let layout: Record<string, string[]> = { todo: ['a', 'b'] };
    const store = createBoardStore(
      api({
        getConfig: vi.fn(async () => ({ ...config, layout })),
        listTasks: vi.fn(async () => ({ tasks: listing, warnings: [] })),
        reorderTask: fn as unknown as BoardAPI['reorderTask'],
      }),
    );
    await store.getState().refresh();

    const moving = store.getState().reorderTask('a', 'done', -1);

    // An external reorder of an unrelated column lands mid-flight. Its layout
    // is held back, so the board would otherwise stay stale indefinitely —
    // SyncEffects is event-driven and this event is already spent.
    listing = [seed('a'), seed('b')];
    layout = { todo: ['b', 'a'] };
    await store.getState().refresh();
    // Still the optimistic layout (a already lifted out of todo by the move) —
    // the external reordering was dropped, not applied.
    expect(store.getState().config?.layout).toEqual({ todo: ['b'] });

    settles[0]?.resolve({ task: seed('a', 'done'), layout: { todo: ['a'] } });
    await moving;
    // Settling triggers the owed re-read; let it flush.
    await vi.waitFor(() =>
      expect(store.getState().config?.layout).toEqual({ todo: ['b', 'a'] }),
    );
  });

  it('scopes a failed move to its own slug, keeping another slug’s server result', async () => {
    const { fn, settles } = deferredReorder();
    const store = createBoardStore(
      api({
        listTasks: vi.fn(async () => ({
          tasks: [seed('a'), seed('b')],
          warnings: [],
        })),
        reorderTask: fn as unknown as BoardAPI['reorderTask'],
      }),
    );
    await store.getState().refresh();
    vi.spyOn(toast, 'error').mockImplementation(() => '');

    const movingA = store.getState().reorderTask('a', 'done', -1);
    const movingB = store.getState().reorderTask('b', 'done', -1);

    // A succeeds, and the server hands back an authoritative task.
    const serverA = task({
      slug: 'a',
      frontmatter: {
        ...task().frontmatter,
        status: 'done',
        updated: '2026-07-01T00:00:00.000Z',
      },
    });
    settles[0]?.resolve({ task: serverA, layout: { todo: ['b'] } });
    await movingA;

    // B fails afterwards. Its rollback must not reach across to A.
    settles[1]?.reject(new Error('boom'));
    await movingB;

    expect(
      store.getState().tasks.find(t => t.slug === 'a')?.frontmatter.updated,
    ).toBe('2026-07-01T00:00:00.000Z');
    expect(statusOf(store, 'a')).toBe('done');
    expect(statusOf(store, 'b')).toBe('todo');
  });

  it('re-seats a rolled-back slug at its original layout index', async () => {
    const { fn, settles } = deferredReorder();
    const store = createBoardStore(
      api({
        getConfig: vi.fn(async () => ({
          ...config,
          layout: { todo: ['a', 'b', 'c'] },
        })),
        listTasks: vi.fn(async () => ({
          tasks: [seed('a'), seed('b'), seed('c')],
          warnings: [],
        })),
        reorderTask: fn as unknown as BoardAPI['reorderTask'],
      }),
    );
    await store.getState().refresh();
    vi.spyOn(toast, 'error').mockImplementation(() => '');

    const moving = store.getState().reorderTask('b', 'todo', 0);
    expect(store.getState().config?.layout).toEqual({ todo: ['b', 'a', 'c'] });

    settles[0]?.reject(new Error('boom'));
    await moving;

    expect(store.getState().config?.layout).toEqual({ todo: ['a', 'b', 'c'] });
  });
});
