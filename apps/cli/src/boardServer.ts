import { spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { platform } from 'node:process';
import {
  ArchiveBlockedError,
  addComment,
  archiveTask,
  createTask,
  deleteComment,
  deleteTask,
  editComment,
  listArchivedTasks,
  listTasks,
  loadConfig,
  reorderTask,
  type StorageAdapter,
  type TaskFrontmatter,
  unarchiveTask,
  updateTask,
} from '@shipbench/core';
import { CONFIG_PATH } from './tui/paths.js';
import { type ProjectWatcher, watchProject } from './tui/watch.js';

const DEFAULT_HOST = '127.0.0.1';
const PORT_ATTEMPTS = 10;

export interface BoardServerOptions {
  adapter: StorageAdapter;
  cwd: string;
  bundleDir: string;
  port: number;
  watch?: boolean;
  /** Receives non-fatal project read warnings. */
  warn?: (line: string) => void;
}

export interface BoardServer {
  port: number;
  url: string;
  close(): Promise<void>;
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(body));
}

function sendError(res: ServerResponse, status: number, error: string): void {
  sendJson(res, status, { error });
}

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (/ENOENT/.test(error.message) ||
      /no such file/i.test(error.message) ||
      /not found/i.test(error.message))
  );
}

function isValidationError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /^(Invalid|Task (?:title|update text|update index) must|Cannot (?:add|edit|delete) an update|Config must|Duplicate|Default priority|default_column|done_column|Layout key|Request body|"[^"]+" must)/i.test(
      error.message,
    )
  );
}

function coreErrorStatus(error: unknown): number {
  if (isNotFoundError(error)) return 404;
  if (error instanceof ArchiveBlockedError) return 409;
  if (isValidationError(error)) return 400;
  return 500;
}

async function readJson(req: IncomingMessage): Promise<JsonObject> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > 1_000_000) throw new Error('Request body is too large.');
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw.trim()) return {};

  const parsed = JSON.parse(raw) as unknown;
  if (!isObject(parsed)) throw new Error('Request body must be a JSON object.');
  return parsed;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`"${field}" must be a string.`);
  }
  return value;
}

function optionalTaskFields(value: unknown): Partial<TaskFrontmatter> {
  if (value === undefined) return {};
  if (!isObject(value)) throw new Error('"fields" must be an object.');
  return value as Partial<TaskFrontmatter>;
}

function optionalBody(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error('"body" must be a string.');
  return value;
}

function parsePosition(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error('"position" must be an integer.');
  }
  return value;
}

function parseCommentIndex(value: string): number {
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0) {
    throw new Error('Task update index must be a non-negative integer.');
  }
  return index;
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw new Error(`"${field}" must be a boolean.`);
  }
  return value;
}

function contentType(path: string): string {
  switch (extname(path)) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
    case '.map':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    case '.ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}

async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  bundleDir: string,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  const relative = pathname === '/' ? '/standalone.html' : pathname;
  const root = resolve(bundleDir);
  const target = resolve(root, `.${relative}`);

  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    sendError(res, 403, 'Forbidden');
    return;
  }

  try {
    const content = await readFile(target);
    res.writeHead(200, { 'content-type': contentType(target) });
    if (req.method === 'HEAD') res.end();
    else res.end(content);
  } catch (error) {
    if (isNotFoundError(error)) {
      sendError(res, 404, 'Not found');
      return;
    }
    throw error;
  }
}

export function createBoardRequestHandler(
  adapter: StorageAdapter,
  bundleDir: string,
  warn?: (line: string) => void,
): {
  handle(req: IncomingMessage, res: ServerResponse): Promise<void>;
  broadcastTasksChanged(): void;
  closeEvents(): void;
} {
  const eventClients = new Set<ServerResponse>();
  const loadServerConfig = () =>
    loadConfig(adapter, {
      onWarning: warning => {
        warn?.(`${warning.path}: ${warning.message}`);
      },
    });

  function broadcastTasksChanged(): void {
    for (const client of eventClients) {
      client.write('event: tasks-changed\n');
      client.write('data: {}\n\n');
    }
  }

  function closeEvents(): void {
    for (const client of eventClients) {
      client.end();
    }
    eventClients.clear();
  }

  async function handleApi(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
  ): Promise<void> {
    if (req.method === 'GET' && url.pathname === '/api/events') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      });
      res.write(': connected\n\n');
      eventClients.add(res);
      req.on('close', () => eventClients.delete(res));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/config') {
      sendJson(res, 200, await loadServerConfig());
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/tasks') {
      const config = await loadServerConfig();
      sendJson(res, 200, await listTasks(adapter, config));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/tasks/archived') {
      const config = await loadServerConfig();
      sendJson(res, 200, await listArchivedTasks(adapter, config));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/tasks') {
      const body = await readJson(req);
      const config = await loadServerConfig();
      const task = await createTask(
        adapter,
        config,
        requireString(body.title, 'title'),
        optionalTaskFields(body.fields),
      );
      sendJson(res, 200, task);
      return;
    }

    const taskMatch =
      /^\/api\/tasks\/([^/]+)(?:\/(reorder|archive|unarchive|comments)(?:\/([^/]+))?)?$/.exec(
        url.pathname,
      );
    if (!taskMatch) {
      sendError(res, 404, 'Not found');
      return;
    }

    const slug = decodeURIComponent(taskMatch[1]);
    const subroute = taskMatch[2];
    const commentIndex = taskMatch[3];

    if (req.method === 'PATCH' && !subroute) {
      const body = await readJson(req);
      const config = await loadServerConfig();
      const result = await updateTask(
        adapter,
        config,
        slug,
        optionalTaskFields(body.fields),
        optionalBody(body.body),
      );
      sendJson(res, 200, result);
      return;
    }

    if (req.method === 'POST' && subroute === 'reorder') {
      const body = await readJson(req);
      const config = await loadServerConfig();
      const result = await reorderTask(
        adapter,
        config,
        slug,
        requireString(body.toStatus, 'toStatus'),
        parsePosition(body.position),
      );
      sendJson(res, 200, result);
      return;
    }

    if (
      req.method === 'POST' &&
      subroute === 'comments' &&
      commentIndex === undefined
    ) {
      const body = await readJson(req);
      const config = await loadServerConfig();
      sendJson(
        res,
        200,
        await addComment(
          adapter,
          config,
          slug,
          requireString(body.text, 'text'),
        ),
      );
      return;
    }

    if (
      req.method === 'PATCH' &&
      subroute === 'comments' &&
      commentIndex !== undefined
    ) {
      const body = await readJson(req);
      const config = await loadServerConfig();
      sendJson(
        res,
        200,
        await editComment(
          adapter,
          config,
          slug,
          parseCommentIndex(commentIndex),
          requireString(body.text, 'text'),
        ),
      );
      return;
    }

    if (
      req.method === 'DELETE' &&
      subroute === 'comments' &&
      commentIndex !== undefined
    ) {
      const config = await loadServerConfig();
      sendJson(
        res,
        200,
        await deleteComment(
          adapter,
          config,
          slug,
          parseCommentIndex(commentIndex),
        ),
      );
      return;
    }

    if (req.method === 'POST' && subroute === 'archive') {
      const body = await readJson(req);
      const config = await loadServerConfig();
      await archiveTask(adapter, config, slug, {
        force: optionalBoolean(body.force, 'force'),
      });
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'POST' && subroute === 'unarchive') {
      const config = await loadServerConfig();
      sendJson(res, 200, await unarchiveTask(adapter, config, slug));
      return;
    }

    if (req.method === 'DELETE' && !subroute) {
      const config = await loadServerConfig();
      await deleteTask(adapter, config, slug);
      res.writeHead(204);
      res.end();
      return;
    }

    sendError(res, 404, 'Not found');
  }

  return {
    async handle(req, res) {
      const url = new URL(req.url ?? '/', 'http://localhost');

      try {
        if (url.pathname.startsWith('/api/')) {
          await handleApi(req, res, url);
          return;
        }

        if (req.method !== 'GET' && req.method !== 'HEAD') {
          sendError(res, 404, 'Not found');
          return;
        }

        await serveStatic(req, res, bundleDir);
      } catch (error) {
        const status =
          error instanceof SyntaxError ? 400 : coreErrorStatus(error);
        const message =
          error instanceof Error && status !== 500
            ? error.message
            : 'Internal server error';
        sendError(res, status, message);
      }
    },
    broadcastTasksChanged,
    closeEvents,
  };
}

function listen(
  server: ReturnType<typeof createServer>,
  port: number,
): Promise<void> {
  return new Promise((resolveListen, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolveListen();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, DEFAULT_HOST);
  });
}

async function listenOnAvailablePort(
  handler: ReturnType<typeof createBoardRequestHandler>,
  preferredPort: number,
): Promise<{ server: ReturnType<typeof createServer>; port: number }> {
  const attempts = preferredPort === 0 ? 1 : PORT_ATTEMPTS;
  for (let offset = 0; offset < attempts; offset += 1) {
    const port = preferredPort + offset;
    const server = createServer((req, res) => {
      void handler.handle(req, res);
    });

    try {
      await listen(server, port);
      const address = server.address();
      const actualPort =
        typeof address === 'object' && address !== null ? address.port : port;
      return { server, port: actualPort };
    } catch (error) {
      if (
        error instanceof Error &&
        (error as NodeJS.ErrnoException).code === 'EADDRINUSE'
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `No available port found from ${preferredPort} to ${
      preferredPort + PORT_ATTEMPTS - 1
    }.`,
  );
}

function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolveClose, reject) => {
    server.close(error => {
      if (error) reject(error);
      else resolveClose();
    });
  });
}

export async function startBoardServer(
  options: BoardServerOptions,
): Promise<BoardServer> {
  try {
    await options.adapter.readFile(CONFIG_PATH);
  } catch {
    throw new Error(
      'No .shipbench/config.json found. Run shipbench init first.',
    );
  }

  await access(join(options.bundleDir, 'standalone.html'));

  const handler = createBoardRequestHandler(
    options.adapter,
    options.bundleDir,
    options.warn,
  );
  const { server, port } = await listenOnAvailablePort(handler, options.port);
  let watcher: ProjectWatcher | undefined;

  if (options.watch !== false) {
    watcher = await watchProject(options.cwd, () =>
      handler.broadcastTasksChanged(),
    );
  }

  return {
    port,
    url: `http://${DEFAULT_HOST}:${port}/`,
    async close() {
      await watcher?.close();
      handler.closeEvents();
      await closeServer(server);
    },
  };
}

export function resolveBoardBundleDir(): string {
  const require = createRequire(import.meta.url);
  const packageJsonPath = require.resolve('@shipbench/board/package.json');
  return join(dirname(packageJsonPath), 'dist');
}

export function openBrowser(url: string): void {
  const command =
    platform === 'win32' ? 'cmd' : platform === 'darwin' ? 'open' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}
