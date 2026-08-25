import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createTask,
  FsAdapter,
  initProject,
  loadConfig,
  type Task,
} from '@shipbench/core';
import { afterEach, describe, expect, it } from 'vitest';
import { type BoardServer, startBoardServer } from './boardServer.js';

interface Fixture {
  root: string;
  bundleDir: string;
  adapter: FsAdapter;
  server?: BoardServer;
}

const fixtures: Fixture[] = [];

async function makeFixture(): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), 'shipbench-board-'));
  const bundleDir = join(root, 'bundle');
  await mkdir(bundleDir);
  await mkdir(join(bundleDir, 'assets'));
  await import('node:fs/promises').then(({ writeFile }) =>
    writeFile(
      join(bundleDir, 'standalone.html'),
      '<div id="root"></div>',
      'utf-8',
    ),
  );

  const adapter = new FsAdapter(root);
  await initProject(adapter, { name: 'Board Test' });

  const fixture = { root, bundleDir, adapter };
  fixtures.push(fixture);
  return fixture;
}

async function startFixture(
  fixture: Fixture,
  watch = false,
): Promise<BoardServer> {
  fixture.server = await startBoardServer({
    adapter: fixture.adapter,
    cwd: fixture.root,
    bundleDir: fixture.bundleDir,
    port: 0,
    watch,
  });
  return fixture.server;
}

async function json<T>(
  server: BoardServer,
  path: string,
  init?: RequestInit,
): Promise<{ response: Response; body: T }> {
  const response = await fetch(`${server.url}${path.replace(/^\//, '')}`, init);
  const body = (await response.json()) as T;
  return { response, body };
}

function jsonInit(value: unknown, method: string): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  };
}

async function waitForSseEvent(response: Response): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('SSE response did not expose a body.');

  const decoder = new TextDecoder();
  let buffer = '';
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error('Timed out waiting for SSE event.')),
      2000,
    );
  });

  try {
    while (!buffer.includes('event: tasks-changed')) {
      const result = await Promise.race([reader.read(), timeout]);
      if (result.done) throw new Error('SSE stream ended before an event.');
      buffer += decoder.decode(result.value, { stream: true });
    }
  } finally {
    await reader.cancel();
  }
}

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    await fixture.server?.close();
    await rm(fixture.root, { recursive: true, force: true });
  }
});

describe('board REST API', () => {
  it('serves config and task CRUD endpoints', async () => {
    const fixture = await makeFixture();
    const server = await startFixture(fixture);

    const configResponse = await json<{ name: string }>(server, '/api/config');
    expect(configResponse.response.status).toBe(200);
    expect(configResponse.body.name).toBe('Board Test');

    const createResponse = await json<Task>(
      server,
      '/api/tasks',
      jsonInit(
        {
          title: 'API task',
          fields: { status: 'todo', priority: 'high' },
        },
        'POST',
      ),
    );
    expect(createResponse.response.status).toBe(200);
    expect(createResponse.body.slug).toBe('api-task');

    const patchResponse = await json<{ task: Task }>(
      server,
      '/api/tasks/api-task',
      jsonInit(
        {
          fields: { title: 'Updated API task' },
          body: 'Updated body',
        },
        'PATCH',
      ),
    );
    expect(patchResponse.response.status).toBe(200);
    expect(patchResponse.body.task.frontmatter.title).toBe('Updated API task');
    expect(patchResponse.body.task.body).toBe('Updated body');

    const commentResponse = await json<Task>(
      server,
      '/api/tasks/api-task/comments',
      jsonInit({ text: 'Scope changed after review.' }, 'POST'),
    );
    expect(commentResponse.response.status).toBe(200);
    expect(commentResponse.body.comments.at(-1)?.text).toBe(
      'Scope changed after review.',
    );
    expect(commentResponse.body.frontmatter.updated).toBe(
      commentResponse.body.comments.at(-1)?.timestamp,
    );

    const originalCommentTimestamp =
      commentResponse.body.comments[0]!.timestamp;
    const editCommentResponse = await json<Task>(
      server,
      '/api/tasks/api-task/comments/0',
      jsonInit({ text: 'Corrected scope decision.' }, 'PATCH'),
    );
    expect(editCommentResponse.response.status).toBe(200);
    expect(editCommentResponse.body.comments).toEqual([
      {
        timestamp: originalCommentTimestamp,
        text: 'Corrected scope decision.',
      },
    ]);

    const deleteCommentResponse = await json<Task>(
      server,
      '/api/tasks/api-task/comments/0',
      { method: 'DELETE' },
    );
    expect(deleteCommentResponse.response.status).toBe(200);
    expect(deleteCommentResponse.body.comments).toEqual([]);

    const reorderResponse = await json<{ task: Task }>(
      server,
      '/api/tasks/api-task/reorder',
      jsonInit({ toStatus: 'done', position: 0 }, 'POST'),
    );
    expect(reorderResponse.response.status).toBe(200);
    expect(reorderResponse.body.task.frontmatter.status).toBe('done');

    const archiveResponse = await fetch(
      `${server.url}api/tasks/api-task/archive`,
      jsonInit({}, 'POST'),
    );
    expect(archiveResponse.status).toBe(204);

    const archivedTasksResponse = await json<{ tasks: Task[] }>(
      server,
      '/api/tasks',
    );
    expect(
      archivedTasksResponse.body.tasks.some(task => task.slug === 'api-task'),
    ).toBe(false);

    const archiveResponseBody = await json<{ tasks: Task[] }>(
      server,
      '/api/tasks/archived',
    );
    expect(archiveResponseBody.response.status).toBe(200);
    expect(
      archiveResponseBody.body.tasks.some(task => task.slug === 'api-task'),
    ).toBe(true);

    const unarchiveResponse = await json<Task>(
      server,
      '/api/tasks/api-task/unarchive',
      jsonInit({}, 'POST'),
    );
    expect(unarchiveResponse.response.status).toBe(200);
    expect(unarchiveResponse.body.slug).toBe('api-task');

    const tasksResponse = await json<{ tasks: Task[] }>(server, '/api/tasks');
    expect(tasksResponse.response.status).toBe(200);
    expect(
      tasksResponse.body.tasks.some(task => task.slug === 'api-task'),
    ).toBe(true);

    const deleteResponse = await fetch(`${server.url}api/tasks/api-task`, {
      method: 'DELETE',
    });
    expect(deleteResponse.status).toBe(204);
  });

  it('returns 400 for validation errors from core', async () => {
    const fixture = await makeFixture();
    const server = await startFixture(fixture);

    const { response, body } = await json<{ error: string }>(
      server,
      '/api/tasks',
      jsonInit(
        {
          title: 'Invalid status task',
          fields: { status: 'missing' },
        },
        'POST',
      ),
    );

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/invalid status/i);
  });

  it('validates task update request bodies', async () => {
    const fixture = await makeFixture();
    const config = await loadConfig(fixture.adapter);
    await createTask(fixture.adapter, config, 'Comment target');
    const server = await startFixture(fixture);

    const wrongType = await json<{ error: string }>(
      server,
      '/api/tasks/comment-target/comments',
      jsonInit({ text: 42 }, 'POST'),
    );
    expect(wrongType.response.status).toBe(400);
    expect(wrongType.body.error).toMatch(/"text" must be a string/i);

    const blank = await json<{ error: string }>(
      server,
      '/api/tasks/comment-target/comments',
      jsonInit({ text: '   ' }, 'POST'),
    );
    expect(blank.response.status).toBe(400);
    expect(blank.body.error).toMatch(/must not be blank/i);

    const invalidIndex = await json<{ error: string }>(
      server,
      '/api/tasks/comment-target/comments/not-a-number',
      { method: 'DELETE' },
    );
    expect(invalidIndex.response.status).toBe(400);
    expect(invalidIndex.body.error).toMatch(/non-negative integer/i);
  });

  it('serves an empty layout when layout.json is absent', async () => {
    const fixture = await makeFixture();
    await fixture.adapter.deleteFile('.shipbench/layout.json');
    const server = await startFixture(fixture);

    const { response, body } = await json<{ layout: unknown }>(
      server,
      '/api/config',
    );

    expect(response.status).toBe(200);
    expect(body.layout).toEqual({});
  });

  it('creates tasks in default_column when status is omitted', async () => {
    const fixture = await makeFixture();
    const rawConfig = await fixture.adapter.readFile('.shipbench/config.json');
    const config = JSON.parse(rawConfig);
    config.columns = [
      { id: 'blocked', label: 'Blocked' },
      { id: 'todo', label: 'To Do' },
      { id: 'done', label: 'Done' },
    ];
    config.default_column = 'todo';
    config.done_column = 'done';
    await fixture.adapter.writeFile(
      '.shipbench/config.json',
      `${JSON.stringify(config, null, 2)}\n`,
    );
    const server = await startFixture(fixture);

    const { response, body } = await json<Task>(
      server,
      '/api/tasks',
      jsonInit({ title: 'Default column API task' }, 'POST'),
    );

    expect(response.status).toBe(200);
    expect(body.frontmatter.status).toBe('todo');
  });

  it('returns 404 for missing tasks', async () => {
    const fixture = await makeFixture();
    const server = await startFixture(fixture);

    const { response, body } = await json<{ error: string }>(
      server,
      '/api/tasks/nope',
      jsonInit({ fields: { title: 'Nope' } }, 'PATCH'),
    );

    expect(response.status).toBe(404);
    expect(body.error).toMatch(/nope|ENOENT/i);
  });

  it('guards non-done archive requests with live dependents unless forced', async () => {
    const fixture = await makeFixture();
    const config = await loadConfig(fixture.adapter);
    await createTask(fixture.adapter, config, 'Foundation');
    await createTask(fixture.adapter, config, 'Dependent', {
      depends_on: ['foundation'],
    });
    const server = await startFixture(fixture);

    const blocked = await json<{ error: string }>(
      server,
      '/api/tasks/foundation/archive',
      jsonInit({}, 'POST'),
    );

    expect(blocked.response.status).toBe(409);
    expect(blocked.body.error).toMatch(/dependent/i);

    const forced = await fetch(
      `${server.url}api/tasks/foundation/archive`,
      jsonInit({ force: true }, 'POST'),
    );
    expect(forced.status).toBe(204);
  });

  it('keeps layout.json consistent when PATCHing status on a task', async () => {
    const fixture = await makeFixture();
    const config = await loadConfig(fixture.adapter);
    await createTask(fixture.adapter, config, 'Patch Status Task', {
      status: 'todo',
    });
    const server = await startFixture(fixture);

    const patchResponse = await json<{
      task: Task;
      layout?: Record<string, string[]>;
    }>(
      server,
      '/api/tasks/patch-status-task',
      jsonInit(
        {
          fields: { status: 'done' },
        },
        'PATCH',
      ),
    );
    expect(patchResponse.response.status).toBe(200);
    expect(patchResponse.body.task.frontmatter.status).toBe('done');

    const layoutRaw = await fixture.adapter.readFile('.shipbench/layout.json');
    const layout = JSON.parse(layoutRaw) as Record<string, string[]>;
    expect(layout.todo).not.toContain('patch-status-task');
    expect(layout.done).toBeUndefined();
  });
});

describe('board watcher SSE', () => {
  it('emits an event when a task file changes on disk', async () => {
    const fixture = await makeFixture();
    const server = await startFixture(fixture, true);
    const events = await fetch(`${server.url}api/events`);
    expect(events.status).toBe(200);

    const eventPromise = waitForSseEvent(events);
    const config = await loadConfig(fixture.adapter);
    await createTask(fixture.adapter, config, 'External edit');

    await expect(eventPromise).resolves.toBeUndefined();
  });

  it('emits an event when layout.json changes on disk', async () => {
    const fixture = await makeFixture();
    const server = await startFixture(fixture, true);
    const events = await fetch(`${server.url}api/events`);
    expect(events.status).toBe(200);

    const eventPromise = waitForSseEvent(events);
    await fixture.adapter.writeFile(
      '.shipbench/layout.json',
      '{"todo":["welcome-to-shipbench"]}\n',
    );

    await expect(eventPromise).resolves.toBeUndefined();
  });

  it('emits events when task Updates are appended, edited, and deleted through the API', async () => {
    const fixture = await makeFixture();
    const config = await loadConfig(fixture.adapter);
    await createTask(fixture.adapter, config, 'Task update event');
    const server = await startFixture(fixture, true);
    const events = await fetch(`${server.url}api/events`);
    expect(events.status).toBe(200);

    const eventPromise = waitForSseEvent(events);
    const comment = await fetch(
      `${server.url}api/tasks/task-update-event/comments`,
      jsonInit({ text: 'Scope changed after review.' }, 'POST'),
    );

    expect(comment.status).toBe(200);
    await expect(eventPromise).resolves.toBeUndefined();

    const editEvents = await fetch(`${server.url}api/events`);
    const editEvent = waitForSseEvent(editEvents);
    const edited = await fetch(
      `${server.url}api/tasks/task-update-event/comments/0`,
      jsonInit({ text: 'Corrected scope decision.' }, 'PATCH'),
    );
    expect(edited.status).toBe(200);
    await expect(editEvent).resolves.toBeUndefined();

    const deleteEvents = await fetch(`${server.url}api/events`);
    const deleteEvent = waitForSseEvent(deleteEvents);
    const deleted = await fetch(
      `${server.url}api/tasks/task-update-event/comments/0`,
      { method: 'DELETE' },
    );
    expect(deleted.status).toBe(200);
    await expect(deleteEvent).resolves.toBeUndefined();
  });

  it('emits events when a task is archived and unarchived through the API', async () => {
    const fixture = await makeFixture();
    const config = await loadConfig(fixture.adapter);
    await createTask(fixture.adapter, config, 'Archive event');
    const server = await startFixture(fixture, true);

    const archiveEvents = await fetch(`${server.url}api/events`);
    const archiveEvent = waitForSseEvent(archiveEvents);
    const archived = await fetch(
      `${server.url}api/tasks/archive-event/archive`,
      jsonInit({}, 'POST'),
    );
    expect(archived.status).toBe(204);
    await expect(archiveEvent).resolves.toBeUndefined();

    const unarchiveEvents = await fetch(`${server.url}api/events`);
    const unarchiveEvent = waitForSseEvent(unarchiveEvents);
    const unarchived = await fetch(
      `${server.url}api/tasks/archive-event/unarchive`,
      jsonInit({}, 'POST'),
    );
    expect(unarchived.status).toBe(200);
    await expect(unarchiveEvent).resolves.toBeUndefined();
  });
});
