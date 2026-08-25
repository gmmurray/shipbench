import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubAdapter, GitHubApiError } from './github.js';

type FetchArgs = { url: string; init?: RequestInit };

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function mockResponse(body: unknown, init: { status?: number } = {}): Response {
  const status = init.status ?? 200;
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(text, {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeFetch(handler: (args: FetchArgs) => Response) {
  const calls: FetchArgs[] = [];
  const fn = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const call: FetchArgs = { url: url.toString(), init };
    calls.push(call);
    return handler(call);
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

const baseOptions = {
  owner: 'octocat',
  repo: 'hello',
  token: 'TOKEN',
};

describe('GitHubAdapter.readFile', () => {
  it("uses the repository's default branch when no branch is configured", async () => {
    const { fn, calls } = makeFetch(() =>
      mockResponse({
        type: 'file',
        encoding: 'base64',
        sha: 'abc',
        name: 'README.md',
        path: 'README.md',
        content: utf8ToBase64('# Hello'),
      }),
    );
    const adapter = new GitHubAdapter({ ...baseOptions, fetch: fn });

    await adapter.readFile('README.md');

    expect(calls[0].url).toBe(
      'https://api.github.com/repos/octocat/hello/contents/README.md',
    );
  });

  it('GETs the contents endpoint with the configured branch and decodes base64', async () => {
    const { fn, calls } = makeFetch(() =>
      mockResponse({
        type: 'file',
        encoding: 'base64',
        sha: 'abc',
        name: 'config.json',
        path: '.shipbench/config.json',
        content: utf8ToBase64('{"hello":"world"}'),
      }),
    );
    const adapter = new GitHubAdapter({
      ...baseOptions,
      branch: 'develop',
      fetch: fn,
    });

    const content = await adapter.readFile('.shipbench/config.json');

    expect(content).toBe('{"hello":"world"}');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      'https://api.github.com/repos/octocat/hello/contents/.shipbench/config.json?ref=develop',
    );
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer TOKEN');
    expect(headers.Accept).toBe('application/vnd.github.v3+json');
    expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28');
  });

  it('invokes fetch without binding the adapter as its receiver', async () => {
    const fetchImpl = function (this: unknown) {
      expect(this).toBeUndefined();
      return Promise.resolve(
        mockResponse({
          type: 'file',
          encoding: 'base64',
          sha: 'abc',
          name: 'README.md',
          path: 'README.md',
          content: utf8ToBase64('# Hello'),
        }),
      );
    } as unknown as typeof fetch;
    const adapter = new GitHubAdapter({ ...baseOptions, fetch: fetchImpl });

    await expect(adapter.readFile('README.md')).resolves.toBe('# Hello');
  });

  it('roundtrips multi-byte UTF-8 content', async () => {
    const content = '# café — naïve résumé\n';
    const { fn } = makeFetch(() =>
      mockResponse({
        type: 'file',
        encoding: 'base64',
        sha: 'x',
        name: 'a.md',
        path: 'a.md',
        content: utf8ToBase64(content),
      }),
    );
    const adapter = new GitHubAdapter({ ...baseOptions, fetch: fn });
    expect(await adapter.readFile('a.md')).toBe(content);
  });

  it('strips line wrapping that GitHub adds to base64 content', async () => {
    const content = 'hello world';
    const wrapped = `${utf8ToBase64(content).slice(0, 4)}\n${utf8ToBase64(content).slice(4)}\n`;
    const { fn } = makeFetch(() =>
      mockResponse({
        type: 'file',
        encoding: 'base64',
        sha: 'x',
        name: 'a.md',
        path: 'a.md',
        content: wrapped,
      }),
    );
    const adapter = new GitHubAdapter({ ...baseOptions, fetch: fn });
    expect(await adapter.readFile('a.md')).toBe(content);
  });

  it('throws on 404', async () => {
    const { fn } = makeFetch(() => mockResponse('not found', { status: 404 }));
    const adapter = new GitHubAdapter({ ...baseOptions, fetch: fn });
    await expect(adapter.readFile('missing.md')).rejects.toThrow(/404/);
  });

  it('exposes upstream status and resource details on API failures', async () => {
    const { fn } = makeFetch(() =>
      mockResponse('rate limited', { status: 403 }),
    );
    const adapter = new GitHubAdapter({ ...baseOptions, fetch: fn });

    const error = await adapter.readFile('README.md').catch(value => value);

    expect(error).toBeInstanceOf(GitHubApiError);
    expect(error).toMatchObject({
      status: 403,
      operation: 'readFile',
      path: 'README.md',
    });
  });

  it('throws when the path refers to a directory', async () => {
    const { fn } = makeFetch(() => mockResponse([]));
    const adapter = new GitHubAdapter({ ...baseOptions, fetch: fn });
    await expect(adapter.readFile('.shipbench/tasks')).rejects.toThrow(
      /directory/i,
    );
  });
});

describe('GitHubAdapter.readFileIfExists', () => {
  it('returns null on 404 without hiding other upstream failures', async () => {
    const { fn } = makeFetch(({ url }) =>
      url.includes('missing')
        ? mockResponse('not found', { status: 404 })
        : mockResponse('rate limited', { status: 403 }),
    );
    const adapter = new GitHubAdapter({ ...baseOptions, fetch: fn });

    await expect(adapter.readFileIfExists('missing.json')).resolves.toBeNull();
    await expect(adapter.readFileIfExists('blocked.json')).rejects.toThrow(
      /403/,
    );
  });

  it('returns decoded content when the file exists', async () => {
    const { fn } = makeFetch(() =>
      mockResponse({
        type: 'file',
        encoding: 'base64',
        sha: 'abc',
        name: 'layout.json',
        path: '.shipbench/layout.json',
        content: utf8ToBase64('{"todo":[]}'),
      }),
    );
    const adapter = new GitHubAdapter({ ...baseOptions, fetch: fn });

    await expect(
      adapter.readFileIfExists('.shipbench/layout.json'),
    ).resolves.toBe('{"todo":[]}');
  });
});

describe('GitHubAdapter.writeFile', () => {
  it('creates a new file when none exists: 404 lookup, then PUT without sha', async () => {
    const { fn, calls } = makeFetch(({ init }) =>
      init?.method === 'PUT'
        ? mockResponse({ content: { sha: 'new' } })
        : mockResponse('not found', { status: 404 }),
    );
    const adapter = new GitHubAdapter({ ...baseOptions, fetch: fn });

    await adapter.writeFile('.shipbench/config.json', '{"a":1}');

    expect(calls).toHaveLength(2);
    expect(calls[0].init?.method).toBeUndefined(); // GET
    const put = calls[1];
    expect(put.init?.method).toBe('PUT');
    const body = JSON.parse(put.init?.body as string);
    expect(body).toEqual({
      message: 'shipbench: create .shipbench/config.json',
      content: utf8ToBase64('{"a":1}'),
    });
    expect(calls[0].url).toBe(
      'https://api.github.com/repos/octocat/hello/contents/.shipbench/config.json',
    );
    expect(body.sha).toBeUndefined();
  });

  it('uses an explicit branch for SHA lookup and the write request', async () => {
    const { fn, calls } = makeFetch(({ init }) =>
      init?.method === 'PUT'
        ? mockResponse({ content: { sha: 'new' } })
        : mockResponse('not found', { status: 404 }),
    );
    const adapter = new GitHubAdapter({
      ...baseOptions,
      branch: 'release/v1',
      fetch: fn,
    });

    await adapter.writeFile('release.md', 'ready');

    expect(calls[0].url).toBe(
      'https://api.github.com/repos/octocat/hello/contents/release.md?ref=release%2Fv1',
    );
    expect(JSON.parse(calls[1].init?.body as string)).toMatchObject({
      branch: 'release/v1',
    });
  });

  it('updates an existing file: looks up SHA, includes it in the PUT', async () => {
    const { fn, calls } = makeFetch(({ init }) =>
      init?.method === 'PUT'
        ? mockResponse({ content: { sha: 'newsha' } })
        : mockResponse({
            type: 'file',
            encoding: 'base64',
            sha: 'oldsha',
            name: 'config.json',
            path: '.shipbench/config.json',
            content: utf8ToBase64('{}'),
          }),
    );
    const adapter = new GitHubAdapter({ ...baseOptions, fetch: fn });

    await adapter.writeFile('.shipbench/config.json', '{"a":1}');

    const body = JSON.parse(calls[1].init?.body as string);
    expect(body.sha).toBe('oldsha');
    expect(body.message).toBe('shipbench: update .shipbench/config.json');
  });

  it('throws when the PUT fails', async () => {
    const { fn } = makeFetch(({ init }) =>
      init?.method === 'PUT'
        ? mockResponse('conflict', { status: 409 })
        : mockResponse('not found', { status: 404 }),
    );
    const adapter = new GitHubAdapter({ ...baseOptions, fetch: fn });
    await expect(adapter.writeFile('x.md', 'y')).rejects.toThrow(/409/);
  });
});

describe('GitHubAdapter.listFiles', () => {
  it('returns only files (filters out directories) by name', async () => {
    const { fn, calls } = makeFetch(() =>
      mockResponse([
        { type: 'file', name: 'a.md', path: 'd/a.md', sha: '1' },
        { type: 'file', name: 'b.md', path: 'd/b.md', sha: '2' },
        { type: 'dir', name: 'archive', path: 'd/archive', sha: '3' },
      ]),
    );
    const adapter = new GitHubAdapter({ ...baseOptions, fetch: fn });
    expect(await adapter.listFiles('d')).toEqual(['a.md', 'b.md']);
    expect(calls[0].url).toBe(
      'https://api.github.com/repos/octocat/hello/contents/d',
    );
  });

  it('returns [] for a missing directory', async () => {
    const { fn } = makeFetch(() => mockResponse('not found', { status: 404 }));
    const adapter = new GitHubAdapter({ ...baseOptions, fetch: fn });
    expect(await adapter.listFiles('nope')).toEqual([]);
  });

  it('throws when the path is a file, not a directory', async () => {
    const { fn } = makeFetch(() =>
      mockResponse({
        type: 'file',
        encoding: 'base64',
        sha: 'x',
        name: 'a.md',
        path: 'a.md',
        content: utf8ToBase64(''),
      }),
    );
    const adapter = new GitHubAdapter({ ...baseOptions, fetch: fn });
    await expect(adapter.listFiles('a.md')).rejects.toThrow(/file/i);
  });
});

describe('GitHubAdapter batch operations', () => {
  it('readFiles parallelizes individual reads', async () => {
    let inflight = 0;
    let maxInflight = 0;
    const calls = vi.fn(async (url: string | URL) => {
      inflight++;
      maxInflight = Math.max(maxInflight, inflight);
      // Defer to next microtask to allow other requests to start.
      await new Promise(resolve => setTimeout(resolve, 5));
      inflight--;
      const name = url.toString().split('/').pop()?.split('?')[0] ?? '';
      return mockResponse({
        type: 'file',
        encoding: 'base64',
        sha: 'x',
        name,
        path: name,
        content: utf8ToBase64(name),
      });
    });
    const adapter = new GitHubAdapter({
      ...baseOptions,
      fetch: calls as unknown as typeof fetch,
    });

    const result = await adapter.readFiles(['a.md', 'b.md', 'c.md']);
    expect(result.size).toBe(3);
    expect(maxInflight).toBe(3);
  });

  it('writeFiles writes sequentially', async () => {
    const order: string[] = [];
    const { fn } = makeFetch(({ url, init }) => {
      if (init?.method === 'PUT') {
        const path = url.split('/contents/')[1].split('?')[0];
        order.push(path);
        return mockResponse({});
      }
      return mockResponse('not found', { status: 404 });
    });
    const adapter = new GitHubAdapter({ ...baseOptions, fetch: fn });

    await adapter.writeFiles(
      new Map([
        ['first.md', 'a'],
        ['second.md', 'b'],
      ]),
    );

    expect(order).toEqual(['first.md', 'second.md']);
  });
});

describe('GitHubAdapter path encoding', () => {
  let fetchCalls: FetchArgs[];
  let adapter: GitHubAdapter;

  beforeEach(() => {
    const { fn, calls } = makeFetch(() =>
      mockResponse({
        type: 'file',
        encoding: 'base64',
        sha: 'x',
        name: 'a',
        path: 'a',
        content: utf8ToBase64(''),
      }),
    );
    fetchCalls = calls;
    adapter = new GitHubAdapter({ ...baseOptions, fetch: fn });
  });

  it('preserves forward slashes in paths but encodes segments', async () => {
    await adapter.readFile('.shipbench/tasks/my task.md');
    expect(fetchCalls[0].url).toContain(
      '/contents/.shipbench/tasks/my%20task.md',
    );
  });
});
