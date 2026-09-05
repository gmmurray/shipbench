import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FsAdapter,
  loadConfig,
  reorderTask,
  type StorageAdapter,
} from '@shipbench/core';
import matter from 'gray-matter';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCli } from './cli.js';
import type { GitRunner } from './harborConnect.js';

function memoryAdapter(
  seed: Record<string, string> = {},
): StorageAdapter & { files: Map<string, string> } {
  const files = new Map(Object.entries(seed));
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
      return [...files.keys()]
        .filter(p => p.startsWith(prefix))
        .map(p => p.slice(prefix.length))
        .filter(path => !path.includes('/'));
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

function setTaskUpdated(h: Harness, slug: string, updated: string): void {
  const path = `.shipbench/tasks/${slug}.md`;
  const raw = h.adapter.files.get(path);
  if (!raw) throw new Error(`Missing test task: ${slug}`);
  const parsed = matter(raw);
  parsed.data.updated = updated;
  h.adapter.files.set(path, matter.stringify(parsed.content, parsed.data));
}

function setTaskCreated(h: Harness, slug: string, created: string): void {
  const path = `.shipbench/tasks/${slug}.md`;
  const raw = h.adapter.files.get(path);
  if (!raw) throw new Error(`Missing test task: ${slug}`);
  const parsed = matter(raw);
  parsed.data.created = created;
  h.adapter.files.set(path, matter.stringify(parsed.content, parsed.data));
}

function setTaskBody(h: Harness, slug: string, body: string): void {
  const path = `.shipbench/tasks/${slug}.md`;
  const raw = h.adapter.files.get(path);
  if (!raw) throw new Error(`Missing test task: ${slug}`);
  const parsed = matter(raw);
  h.adapter.files.set(path, matter.stringify(body, parsed.data));
}

interface Harness {
  adapter: ReturnType<typeof memoryAdapter>;
  stdout: string[];
  stderr: string[];
  run: (...argv: string[]) => Promise<void>;
}

interface HarnessOptions {
  fetch?: typeof fetch;
  readTextFile?: (path: string) => Promise<string>;
  readStdin?: () => Promise<string>;
  getGitRemoteOrigin?: (cwd: string) => Promise<string>;
  runGit?: GitRunner;
  isInteractive?: boolean;
  env?: NodeJS.ProcessEnv;
}

function harness(
  seed?: Record<string, string>,
  options: HarnessOptions = {},
): Harness {
  const adapter = memoryAdapter(seed);
  const stdout: string[] = [];
  const stderr: string[] = [];
  const runGit: GitRunner =
    options.runGit ??
    (async (cwd, args) => {
      const command = args.join(' ');
      if (command === 'rev-parse --show-toplevel') {
        return { exitCode: 0, stdout: cwd };
      }
      if (command === 'remote get-url origin') {
        try {
          return {
            exitCode: 0,
            stdout: options.getGitRemoteOrigin
              ? await options.getGitRemoteOrigin(cwd)
              : 'https://github.com/shipbench/shipbench',
          };
        } catch {
          return { exitCode: 2, stdout: '' };
        }
      }
      if (command === 'cat-file -e HEAD:.shipbench/config.json') {
        return { exitCode: 0, stdout: '' };
      }
      if (
        command === 'status --porcelain=v1 --untracked-files=all -- .shipbench'
      ) {
        return { exitCode: 0, stdout: '' };
      }
      if (
        command === 'rev-parse --abbrev-ref --symbolic-full-name @{upstream}'
      ) {
        return { exitCode: 0, stdout: 'origin/main' };
      }
      if (command === 'rev-list --count @{upstream}..HEAD') {
        return { exitCode: 0, stdout: '0' };
      }
      throw new Error(`Unexpected git command: ${command}`);
    });
  const program = createCli({
    adapter,
    defaultProjectName: 'test-project',
    out: line => stdout.push(line),
    err: line => stderr.push(line),
    fetch: options.fetch,
    readTextFile: options.readTextFile,
    readStdin: options.readStdin,
    runGit,
    isInteractive: options.isInteractive,
    env: options.env,
    exitOverride: true,
  });
  return {
    adapter,
    stdout,
    stderr,
    run: async (...argv) => {
      await program.parseAsync(['node', 'shipbench', ...argv]);
    },
  };
}

describe('shipbench init', () => {
  it('scaffolds the .shipbench/ directory using the default project name', async () => {
    const h = harness();
    await h.run('init');
    expect(h.stdout).toEqual([]);
    expect(h.stderr).toEqual([
      'Initialized .shipbench/ for "test-project" in current directory.',
      '',
      'Next steps:',
      '  1. Create a task: shipbench task create "My first task"',
      '  2. Open the board: shipbench board',
      '  3. Read .shipbench/README.md to learn the project workflow.',
    ]);
    const config = JSON.parse(
      h.adapter.files.get('.shipbench/config.json') ?? '{}',
    );
    expect(config.name).toBe('test-project');
    expect(config).not.toHaveProperty('layout');
    expect(h.adapter.files.get('.shipbench/layout.json')).toBe('{}\n');
    expect(h.adapter.files.has('.shipbench/README.md')).toBe(true);
    expect(h.adapter.files.has('.shipbench/AGENTS.md')).toBe(true);
    expect(
      h.adapter.files.has('.shipbench/tasks/welcome-to-shipbench.md'),
    ).toBe(true);
  });

  it('shows the wordmark only when stdout is an interactive color terminal', async () => {
    const interactive = harness(undefined, {
      isInteractive: true,
      env: {},
    });
    await interactive.run('init');
    expect(interactive.stderr[0]).toBe('\x1b[1;34mSHIPBENCH CLI\x1b[0m');

    const noColor = harness(undefined, {
      isInteractive: true,
      env: { NO_COLOR: '' },
    });
    await noColor.run('init');
    expect(noColor.stderr[0]).toBe(
      'Initialized .shipbench/ for "test-project" in current directory.',
    );
    expect(noColor.stderr.join('\n')).not.toContain('\x1b[');
  });

  it('uses --name to override the default project name', async () => {
    const h = harness();
    await h.run('init', '--name', 'Acme Widgets');
    const config = JSON.parse(
      h.adapter.files.get('.shipbench/config.json') ?? '{}',
    );
    expect(config.name).toBe('Acme Widgets');
  });

  it('states that Harbor was not contacted when connect preflight fails', async () => {
    const h = harness();

    await expect(h.run('init', '--harbor=not-a-url')).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining(
        'ShipBench initialization did not run, and Harbor was not contacted.',
      ),
    });
    expect(h.adapter.files.size).toBe(0);
  });

  it('keeps an existing project readable and warns about malformed layout metadata', async () => {
    const h = harness({
      '.shipbench/config.json': '{}\n',
      '.shipbench/layout.json': '{"todo":',
    });

    await h.run('init');

    expect(h.stdout).toEqual([]);
    expect(h.stderr).toEqual([
      expect.stringMatching(
        /Warning: \.shipbench\/layout\.json:.*fallback order/i,
      ),
      'ShipBench is already initialized for "Untitled Project".',
    ]);
  });

  it('posts the Git origin to Harbor after scaffolding', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const connectUrl =
      'https://harbor.shipbench.dev/projects/project-1/connect?token=secret';
    const h = harness(undefined, {
      getGitRemoteOrigin: async () => 'git@github.com:shipbench/shipbench.git',
      fetch: (async (input, init) => {
        calls.push({ input: String(input), init });
        return Response.json({
          project_id: 'project-1',
          project_name: 'ShipBench',
          github_url: 'https://github.com/shipbench/shipbench',
          message:
            'Connected https://github.com/shipbench/shipbench to ShipBench in Harbor.',
        });
      }) as typeof fetch,
    });

    await h.run('init', `--harbor=${connectUrl}`);

    expect(h.adapter.files.has('.shipbench/config.json')).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe(connectUrl);
    expect(calls[0]?.init).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        remote_url: 'https://github.com/shipbench/shipbench',
      }),
    });
    expect(h.stdout).toEqual([]);
    expect(h.stderr.at(-1)).toBe(
      '  3. Open Harbor to view this ShipBench project.',
    );
    expect(h.stderr).toContain(
      'Connected https://github.com/shipbench/shipbench to ShipBench in Harbor.',
    );
  });

  it.each([
    [
      410,
      'CONNECT_TOKEN_EXPIRED',
      'This connect URL has expired. Generate a new URL in Harbor.',
    ],
    [401, 'INVALID_CONNECT_TOKEN', 'This connect URL is invalid.'],
    [
      400,
      'INVALID_REMOTE_URL',
      'The origin remote is not a supported GitHub repository URL.',
    ],
  ])('reports Harbor connection errors (HTTP %i, %s)', async (status, code, error) => {
    const h = harness(undefined, {
      getGitRemoteOrigin: async () => 'git@github.com:shipbench/shipbench.git',
      fetch: (async () =>
        Response.json({ code, error }, { status })) as typeof fetch,
    });

    await expect(
      h.run(
        'init',
        '--harbor=https://harbor.shipbench.dev/projects/project-1/connect?token=secret',
      ),
    ).rejects.toMatchObject({
      exitCode: 3,
      message: expect.stringContaining(error),
    });
    expect(h.adapter.files.has('.shipbench/config.json')).toBe(true);
  });

  it('directs already-connected users to inspect Harbor before retrying', async () => {
    const h = harness(undefined, {
      getGitRemoteOrigin: async () => 'https://github.com/shipbench/shipbench',
      fetch: (async () =>
        Response.json(
          {
            code: 'PROJECT_ALREADY_CONNECTED',
            error: 'This project is already connected to a repository.',
          },
          { status: 409 },
        )) as typeof fetch,
    });

    await expect(
      h.run(
        'init',
        '--harbor=https://harbor.shipbench.dev/projects/project-1/connect?token=secret',
      ),
    ).rejects.toMatchObject({ exitCode: 3 });
  });

  it('reports a missing origin without sending the signed URL', async () => {
    const connectUrl =
      'https://harbor.shipbench.dev/projects/project-1/connect?token=secret';
    const h = harness(undefined, {
      getGitRemoteOrigin: async () => {
        throw new Error(
          'Could not read Git remote origin. Add a GitHub origin remote, then run this command again.',
        );
      },
    });

    await expect(h.run('init', `--harbor=${connectUrl}`)).rejects.toThrow(
      'No GitHub origin remote was found',
    );
    expect(h.stderr.join('\n')).not.toContain(connectUrl);
    expect(h.stdout.join('\n')).not.toContain(connectUrl);
  });

  it('does not expose the signed URL when the request fails', async () => {
    const connectUrl =
      'https://harbor.shipbench.dev/projects/project-1/connect?token=secret';
    const h = harness(undefined, {
      getGitRemoteOrigin: async () => 'https://github.com/shipbench/shipbench',
      fetch: (async () => {
        throw new Error(`request to ${connectUrl} failed`);
      }) as typeof fetch,
    });

    await expect(h.run('init', `--harbor=${connectUrl}`)).rejects.toThrow(
      "Harbor's result is unknown.",
    );
    expect(h.stderr.join('\n')).not.toContain(connectUrl);
    expect(h.stdout.join('\n')).not.toContain(connectUrl);
  });

  it('reports a no-op and preserves every byte on repeated init', async () => {
    const h = harness();
    await h.run('init');
    h.adapter.files.set('.shipbench/README.md', '# Custom\r\n');
    const before = new Map(h.adapter.files);
    h.stdout.length = 0;
    h.stderr.length = 0;

    await h.run('init');

    expect(h.stdout).toEqual([]);
    expect(h.stderr).toEqual([
      'ShipBench is already initialized for "test-project".',
    ]);
    expect(h.adapter.files).toEqual(before);
  });

  it('routes init --harbor through the existing-project connection path', async () => {
    const fetch = vi.fn(async () =>
      Response.json({ message: 'Connected without reinitializing.' }),
    );
    const h = harness(undefined, {
      fetch: fetch as typeof globalThis.fetch,
    });
    await h.run('init');
    h.adapter.files.set('.shipbench/AGENTS.md', '# Custom instructions\r\n');
    const before = new Map(h.adapter.files);
    h.stdout.length = 0;
    h.stderr.length = 0;

    await h.run(
      'init',
      '--harbor=https://harbor.shipbench.dev/projects/project-1/connect?token=secret',
    );

    expect(h.adapter.files).toEqual(before);
    expect(h.stdout).toEqual([]);
    expect(h.stderr).toEqual([
      'ShipBench is already initialized for "test-project".',
      'Connected without reinitializing.',
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects an explicit --name mismatch without writing or fetching', async () => {
    const fetch = vi.fn();
    const h = harness(undefined, { fetch: fetch as typeof globalThis.fetch });
    await h.run('init');
    const before = new Map(h.adapter.files);

    await expect(
      h.run(
        'init',
        '--name=Another Name',
        '--harbor=https://harbor.shipbench.dev/projects/project-1/connect?token=secret',
      ),
    ).rejects.toMatchObject({ exitCode: 2 });

    expect(h.adapter.files).toEqual(before);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects an incomplete project without writing or fetching', async () => {
    const fetch = vi.fn();
    const h = harness(
      { '.shipbench/README.md': '# Existing partial project\r\n' },
      { fetch: fetch as typeof globalThis.fetch },
    );
    const before = new Map(h.adapter.files);

    await expect(
      h.run(
        'init',
        '--harbor=https://harbor.shipbench.dev/projects/project-1/connect?token=secret',
      ),
    ).rejects.toMatchObject({ exitCode: 2 });

    expect(h.adapter.files).toEqual(before);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('shipbench connect', () => {
  const connectUrl =
    'https://harbor.shipbench.dev/projects/project-1/connect?token=secret';

  it('connects an existing project without modifying ShipBench files', async () => {
    const fetch = vi.fn(async () =>
      Response.json({ message: 'Connected existing project.' }),
    );
    const h = harness(undefined, {
      fetch: fetch as typeof globalThis.fetch,
    });
    await h.run('init');
    h.adapter.files.set('.shipbench/README.md', '# User-owned README\r\n');
    const before = new Map(h.adapter.files);
    h.stdout.length = 0;
    h.stderr.length = 0;

    await h.run('connect', `--harbor=${connectUrl}`);

    expect(h.stdout).toEqual([]);
    expect(h.stderr).toContain('Connected existing project.');
    expect(h.adapter.files).toEqual(before);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('states that files were unchanged when connect preflight fails', async () => {
    const h = harness();

    await expect(h.run('connect', '--harbor=not-a-url')).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining(
        'ShipBench project files were not modified, and Harbor was not contacted.',
      ),
    });
  });

  it('rejects a missing project before fetch', async () => {
    const fetch = vi.fn();
    const h = harness(undefined, { fetch: fetch as typeof globalThis.fetch });

    await expect(
      h.run('connect', `--harbor=${connectUrl}`),
    ).rejects.toMatchObject({ exitCode: 2 });

    expect(fetch).not.toHaveBeenCalled();
    expect(h.adapter.files.size).toBe(0);
  });

  it('rejects malformed and invalid projects before fetch', async () => {
    const fetch = vi.fn();
    const malformed = harness(
      { '.shipbench/config.json': '{"name":' },
      { fetch: fetch as typeof globalThis.fetch },
    );
    await expect(
      malformed.run('connect', `--harbor=${connectUrl}`),
    ).rejects.toMatchObject({ exitCode: 2 });

    const invalid = harness(
      {
        '.shipbench/config.json': JSON.stringify({
          done_column: 'unknown',
        }),
      },
      { fetch: fetch as typeof globalThis.fetch },
    );
    await expect(
      invalid.run('connect', `--harbor=${connectUrl}`),
    ).rejects.toMatchObject({ exitCode: 2 });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('prints task read warnings and continues', async () => {
    const h = harness(undefined, {
      fetch: (async () =>
        Response.json({ message: 'Connected with warnings.' })) as typeof fetch,
    });
    await h.run('init');
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

    await h.run('connect', `--harbor=${connectUrl}`);

    expect(h.stdout).toEqual([]);
    expect(h.stderr.join('\n')).toMatch(/warning.*unknown status/i);
    expect(h.stderr).toContain('Connected with warnings.');
  });

  it('documents the explicit command and required signed URL', async () => {
    const h = harness();

    await expect(h.run('connect', '--help')).rejects.toMatchObject({
      code: 'commander.helpDisplayed',
      exitCode: 0,
    });
    expect(h.stdout.join('\n')).toMatch(
      /Connect an existing ShipBench project to Harbor/i,
    );
    expect(h.stdout.join('\n')).toMatch(/--harbor <connect-url>/);
  });
});

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
    expect(h.stderr.at(-1)).toBe('Updated description on build-api');
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
    expect(h.stderr.at(-1)).toBe('Cleared description on build-api');
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

  it('requires --body or --body-file', async () => {
    await expect(h.run('task', 'edit', 'build-api')).rejects.toMatchObject({
      code: 'commander.error',
      exitCode: 1,
    });
    expect(h.stderr.join('\n')).toContain('Provide --body <text>');
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

describe('shipbench task comment', () => {
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
    expect(payload.comments).toEqual([
      {
        timestamp: expect.any(String),
        text: 'Scope expanded after review.',
      },
    ]);
    const timestamp = Date.parse(payload.comments[0].timestamp);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
    expect(payload.frontmatter.updated).toBe(payload.comments[0].timestamp);
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
    expect(JSON.parse(h.stdout.join('\n')).comments).toEqual([
      { timestamp: expect.any(String), text },
    ]);
  });

  it('reads the update text from stdin for --body-file -', async () => {
    const h = harness(undefined, { readStdin: async () => 'Piped update.' });
    await h.run('init');

    await h.run('task', 'comment', 'welcome-to-shipbench', '--body-file', '-');

    h.stdout.length = 0;
    await h.run('task', 'get', 'welcome-to-shipbench');
    expect(JSON.parse(h.stdout.join('\n')).comments).toEqual([
      { timestamp: expect.any(String), text: 'Piped update.' },
    ]);
  });

  it('replaces an entry from --body-file without changing its timestamp', async () => {
    const h = harness();
    await h.run('init');
    await h.run('task', 'comment', 'welcome-to-shipbench', 'Original.');
    h.stdout.length = 0;
    await h.run('task', 'get', 'welcome-to-shipbench');
    const originalTimestamp = JSON.parse(h.stdout.join('\n')).comments[0]
      .timestamp;

    const dir = await mkdtemp(join(tmpdir(), 'shipbench-update-'));
    const path = join(dir, 'update.md');
    await writeFile(path, '## Corrected\n\nWith a heading.', 'utf8');
    try {
      await h.run(
        'task',
        'comment',
        'edit',
        'welcome-to-shipbench',
        '0',
        '--body-file',
        path,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    h.stdout.length = 0;
    await h.run('task', 'get', 'welcome-to-shipbench');
    expect(JSON.parse(h.stdout.join('\n')).comments).toEqual([
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
    expect(JSON.parse(h.stdout.join('\n')).comments).toEqual([
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
    const originalTimestamp = appended.comments[0].timestamp;

    h.stdout.length = 0;
    h.stderr.length = 0;
    await h.run(
      'task',
      'comment',
      'edit',
      'welcome-to-shipbench',
      '0',
      'Corrected decision.',
    );
    expect(h.stdout).toEqual([]);
    expect(h.stderr).toEqual(['Edited update 0 on welcome-to-shipbench']);

    h.stdout.length = 0;
    await h.run('task', 'get', 'welcome-to-shipbench');
    const edited = JSON.parse(h.stdout.join('\n'));
    expect(edited.comments).toEqual([
      {
        timestamp: originalTimestamp,
        text: 'Corrected decision.',
      },
    ]);

    h.stdout.length = 0;
    h.stderr.length = 0;
    await h.run('task', 'comment', 'delete', 'welcome-to-shipbench', '0');
    expect(h.stdout).toEqual([]);
    expect(h.stderr).toEqual(['Deleted update 0 from welcome-to-shipbench']);

    h.stdout.length = 0;
    await h.run('task', 'get', 'welcome-to-shipbench');
    const deleted = JSON.parse(h.stdout.join('\n'));
    expect(deleted.comments).toEqual([]);
    expect(
      h.adapter.files.get('.shipbench/tasks/welcome-to-shipbench.md'),
    ).not.toContain('## Task Updates');
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

  it('is documented in task help', async () => {
    const h = harness();

    await expect(h.run('task', '--help')).rejects.toMatchObject({
      code: 'commander.helpDisplayed',
      exitCode: 0,
    });
    expect(h.stdout.join('\n')).toMatch(
      /get \[options\] <slug>\s+Retrieve one task as JSON/,
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
        matched_fields: ['title'],
      },
      {
        slug: 'tagged-match',
        title: 'Tagged match',
        matched_fields: ['tags'],
      },
      {
        slug: 'body-match',
        title: 'Body match',
        matched_fields: ['body'],
        snippet: 'First paragraph. The NEEDLE is in this Markdown body.',
      },
    ]);
  });

  it('supports --include-body, --limit, and JSON empty results', async () => {
    const h = await searchHarness();

    await h.run('task', 'search', 'NEEDLE', '--json', '--include-body');
    let payload = JSON.parse(h.stdout.join('\n'));
    expect(payload.matches[2]).toHaveProperty(
      'body',
      'First paragraph.\n\nThe NEEDLE is in this Markdown body.',
    );

    h.stdout.length = 0;
    await h.run('task', 'search', 'NEEDLE', '--json', '--limit=2');
    payload = JSON.parse(h.stdout.join('\n'));
    expect(payload.matches).toHaveLength(2);

    h.stdout.length = 0;
    await h.run('task', 'search', 'absent', '--json');
    payload = JSON.parse(h.stdout.join('\n'));
    expect(payload.matches).toEqual([]);
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

    expect(h.stdout).toEqual([]);
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
      payload.matches.map((match: { slug: string }) => match.slug),
    ).toEqual(['live-scope-marker', 'archived-scope-marker']);
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
      /search \[options\] <query>\s+Search task titles, tags, and Markdown bodies/,
    );

    const searchHelp = harness();
    await expect(
      searchHelp.run('task', 'search', '--help'),
    ).rejects.toMatchObject({
      code: 'commander.helpDisplayed',
      exitCode: 0,
    });
    expect(searchHelp.stdout.join('\n')).toMatch(
      /--archived[\s\S]*--all[\s\S]*--limit <n>[\s\S]*--json[\s\S]*--include-body/,
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
});

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
});

describe('shipbench board terminal', () => {
  // `runTui` reads before it touches the screen, so an unscaffolded project is
  // the one path this suite can drive without a terminal — which is also the
  // path that has to agree with `board`.
  const MISSING = 'No .shipbench/config.json found. Run shipbench init first.';

  it('fails outside a project in the same words as the browser board', async () => {
    const h = harness();
    await expect(h.run('board', 'terminal')).rejects.toThrow(MISSING);
  });

  it.each(['term', 'tui'])('resolves the %s alias', async alias => {
    const h = harness();
    await expect(h.run('board', alias)).rejects.toThrow(MISSING);
  });

  it('gives each surface its own option set', async () => {
    const program = createCli({
      adapter: memoryAdapter(),
      defaultProjectName: 'test-project',
      out: () => {},
      err: () => {},
      exitOverride: true,
    });
    const board = program.commands.find(command => command.name() === 'board');
    expect(board?.commands.map(command => command.name())).toEqual([
      'web',
      'terminal',
    ]);
    const flags = (name: string) =>
      board?.commands
        .find(command => command.name() === name)
        ?.options.map(option => option.long);
    expect(flags('web')).toEqual(['--port', '--no-open']);
    expect(flags('terminal')).toEqual([
      '--status',
      '--assignee',
      '--priority',
      '--tag',
    ]);
    // The browser flags live on `web` alone; bare `board` reaches them because
    // `web` is the default subcommand, not because they are declared twice.
    expect(board?.options).toEqual([]);
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
