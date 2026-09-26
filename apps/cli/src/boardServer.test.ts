import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  addComment,
  archiveTask,
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

  it('rejects a description carrying the Updates marker with a 400', async () => {
    const fixture = await makeFixture();
    const config = await loadConfig(fixture.adapter);
    await createTask(fixture.adapter, config, 'Editable');
    const server = await startFixture(fixture);

    const { response, body } = await json<{ error: string }>(
      server,
      '/api/tasks/editable',
      jsonInit(
        {
          fields: {},
          body: 'Description\n\n## Task Updates\n\n### 2026-01-01T00:00:00Z\nNope.',
        },
        'PATCH',
      ),
    );

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/task comment/);
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

describe('board task routes and slugs', () => {
  // `%2F` decodes to a real separator after routing, so these slugs point at
  // the project's README unless core refuses them.
  it.each([
    ['DELETE', '/api/tasks/..%2F..%2FREADME'],
    ['POST', '/api/tasks/..%2F..%2FREADME/unarchive'],
  ])('%s %s answers 400 and leaves the file in place', async (method, path) => {
    const fixture = await makeFixture();
    const readme = join(fixture.root, 'README.md');
    await writeFile(readme, '# Keep me', 'utf-8');
    const server = await startFixture(fixture);

    const { response, body } = await json<{ error: string }>(server, path, {
      method,
    });

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/^Invalid task slug/);
    await expect(readFile(readme, 'utf-8')).resolves.toBe('# Keep me');
  });
});

describe('board server origin and host checks', () => {
  // undici treats `Host` as a forbidden header, so these requests go through
  // node:http, which sends whatever headers it is given.
  function rawRequest(
    server: BoardServer,
    method: string,
    path: string,
    headers: Record<string, string> = {},
    body?: string,
  ): Promise<{ status: number; body: string }> {
    return new Promise((resolveRequest, reject) => {
      const req = request(
        { host: '127.0.0.1', port: server.port, method, path, headers },
        res => {
          let text = '';
          res.setEncoding('utf-8');
          res.on('data', chunk => {
            text += chunk;
          });
          res.on('end', () =>
            resolveRequest({ status: res.statusCode ?? 0, body: text }),
          );
        },
      );
      req.on('error', reject);
      req.end(body);
    });
  }

  async function snapshot(root: string): Promise<Map<string, string>> {
    const files = new Map<string, string>();
    const entries = await readdir(join(root, '.shipbench'), {
      recursive: true,
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const path = join(entry.parentPath, entry.name);
      files.set(path, await readFile(path, 'utf-8'));
    }
    return files;
  }

  // A board with a commented live task and an archived one, so every
  // mutating route has something it would change if it ran.
  async function seededServer() {
    const fixture = await makeFixture();
    const config = await loadConfig(fixture.adapter);
    await createTask(fixture.adapter, config, 'Target');
    await addComment(fixture.adapter, config, 'target', 'First note.');
    await createTask(fixture.adapter, config, 'Stored');
    await archiveTask(fixture.adapter, config, 'stored', { force: true });
    const server = await startFixture(fixture);
    return { fixture, server };
  }

  const mutatingRoutes: [string, string, string?][] = [
    ['POST', '/api/tasks', '{"title":"Injected"}'],
    ['POST', '/api/tasks/target/reorder', '{"toStatus":"done","position":0}'],
    ['POST', '/api/tasks/target/comments', '{"text":"Injected."}'],
    ['POST', '/api/tasks/target/archive', '{"force":true}'],
    ['POST', '/api/tasks/stored/unarchive'],
    ['PATCH', '/api/tasks/target', '{"fields":{"title":"Injected"}}'],
    ['PATCH', '/api/tasks/target/comments/0', '{"text":"Injected."}'],
    ['DELETE', '/api/tasks/target/comments/0'],
    ['DELETE', '/api/tasks/target'],
  ];

  it.each(
    mutatingRoutes,
  )('rejects a cross-origin text/plain %s %s and writes nothing', async (method, path, body) => {
    const { fixture, server } = await seededServer();
    const before = await snapshot(fixture.root);

    const response = await rawRequest(
      server,
      method,
      path,
      { origin: 'https://attacker.example', 'content-type': 'text/plain' },
      body,
    );

    expect(response.status).toBe(403);
    expect(JSON.parse(response.body).error).toMatch(/other origins/);
    expect(await snapshot(fixture.root)).toEqual(before);
  });

  it.each([
    'null',
    'http://127.0.0.1:1',
    'http://localhost.attacker.example',
  ])('rejects a write whose Origin is %s', async origin => {
    const { fixture, server } = await seededServer();
    const before = await snapshot(fixture.root);

    const response = await rawRequest(
      server,
      'POST',
      '/api/tasks/stored/unarchive',
      { origin },
    );

    expect(response.status).toBe(403);
    expect(await snapshot(fixture.root)).toEqual(before);
  });

  it.each([
    ['an API route', '/api/tasks'],
    ['the event stream', '/api/events'],
    ['a static file', '/standalone.html'],
    ['the board page', '/'],
  ])('rejects a foreign Host on %s', async (_name, path) => {
    const { server } = await seededServer();

    for (const host of [
      `attacker.example:${server.port}`,
      `localhost.attacker.example:${server.port}`,
      `127.0.0.1:${server.port + 1}`,
    ]) {
      const response = await rawRequest(server, 'GET', path, { host });
      expect(response.status).toBe(403);
      expect(JSON.parse(response.body).error).toMatch(/only answers/);
    }
  });

  it('rejects a foreign Host on a write even when Origin matches it', async () => {
    const { fixture, server } = await seededServer();
    const before = await snapshot(fixture.root);
    const host = `attacker.example:${server.port}`;

    const response = await rawRequest(
      server,
      'POST',
      '/api/tasks',
      { host, origin: `http://${host}`, 'content-type': 'application/json' },
      '{"title":"Injected"}',
    );

    expect(response.status).toBe(403);
    expect(await snapshot(fixture.root)).toEqual(before);
  });

  it.each([
    '127.0.0.1',
    'localhost',
    'LOCALHOST',
  ])('accepts reads and same-origin writes addressed to %s', async hostname => {
    const { server } = await seededServer();
    const host = `${hostname}:${server.port}`;

    const read = await rawRequest(server, 'GET', '/api/tasks', { host });
    expect(read.status).toBe(200);

    const write = await rawRequest(
      server,
      'POST',
      '/api/tasks',
      {
        host,
        origin: `http://${host}`,
        'content-type': 'application/json',
      },
      '{"title":"Allowed"}',
    );
    expect(write.status).toBe(200);
  });

  it('accepts a write with no Origin, as curl sends', async () => {
    const { server } = await seededServer();

    const response = await rawRequest(
      server,
      'POST',
      '/api/tasks/stored/unarchive',
    );

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body).slug).toBe('stored');
  });

  // The standalone board's own requests: relative fetches, so the browser
  // sends the board's origin on every write, and unarchive and deletes carry
  // no body or content type.
  it('accepts every board action from the board origin', async () => {
    const { server } = await seededServer();
    const origin = `http://127.0.0.1:${server.port}`;
    const json = { origin, 'content-type': 'application/json' };

    const steps: [string, string, Record<string, string>, string?][] = [
      ['POST', '/api/tasks', json, '{"title":"Created"}'],
      ['PATCH', '/api/tasks/created', json, '{"fields":{"title":"Edited"}}'],
      [
        'POST',
        '/api/tasks/created/reorder',
        json,
        '{"toStatus":"in-progress","position":0}',
      ],
      ['POST', '/api/tasks/created/comments', json, '{"text":"Note."}'],
      [
        'PATCH',
        '/api/tasks/created/comments/0',
        json,
        '{"text":"Edited note."}',
      ],
      ['DELETE', '/api/tasks/created/comments/0', { origin }],
      ['POST', '/api/tasks/created/archive', json, '{"force":true}'],
      ['POST', '/api/tasks/created/unarchive', { origin }],
      ['DELETE', '/api/tasks/created', { origin }],
    ];
    for (const [method, path, headers, body] of steps) {
      const response = await rawRequest(server, method, path, headers, body);
      expect(response.status, `${method} ${path}`).toBeLessThan(300);
    }
  });
});
