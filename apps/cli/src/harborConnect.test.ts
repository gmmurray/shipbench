import { describe, expect, it, vi } from 'vitest';
import {
  CliExitError,
  connectPreparedProjectToHarbor,
  type GitCommandResult,
  type GitRunner,
  prepareHarborConnection,
  validateHarborConnectUrl,
} from './harborConnect.js';

const connectUrl =
  'https://harbor.shipbench.dev/projects/project-1/connect?token=secret-token';

function gitRunner(
  overrides: Record<string, GitCommandResult> = {},
): GitRunner {
  return async (cwd, args) => {
    const command = args.join(' ');
    const defaults: Record<string, GitCommandResult> = {
      'rev-parse --show-toplevel': { exitCode: 0, stdout: cwd },
      'remote get-url origin': {
        exitCode: 0,
        stdout: 'git@github.com:shipbench/shipbench.git',
      },
      'cat-file -e HEAD:.shipbench/config.json': {
        exitCode: 0,
        stdout: '',
      },
      'status --porcelain=v1 --untracked-files=all -- .shipbench': {
        exitCode: 0,
        stdout: '',
      },
      'rev-parse --abbrev-ref --symbolic-full-name @{upstream}': {
        exitCode: 0,
        stdout: 'origin/main',
      },
      'rev-list --count @{upstream}..HEAD': {
        exitCode: 0,
        stdout: '0',
      },
    };
    const result = overrides[command] ?? defaults[command];
    if (!result) throw new Error(`Unexpected git command: ${command}`);
    return result;
  };
}

function successResponse(message = 'Repository connected.'): Response {
  return Response.json({
    project_id: 'project-1',
    project_name: 'ShipBench',
    github_url: 'https://github.com/shipbench/shipbench',
    message,
  });
}

describe('validateHarborConnectUrl', () => {
  it('accepts HTTPS on any host and HTTP on loopback hosts', () => {
    expect(validateHarborConnectUrl(connectUrl)).toBe(connectUrl);
    expect(
      validateHarborConnectUrl(
        'http://localhost:4321/projects/p/connect?token=local',
      ),
    ).toContain('http://localhost:4321/');
    expect(
      validateHarborConnectUrl(
        'http://127.0.0.2:4321/projects/p/connect?token=local',
      ),
    ).toContain('http://127.0.0.2:4321/');
    expect(
      validateHarborConnectUrl(
        'http://[::1]:4321/projects/p/connect?token=local',
      ),
    ).toContain('http://[::1]:4321/');
  });

  it.each([
    'not a URL',
    'http://harbor.example.com/projects/p/connect?token=x',
    'https://user:password@harbor.example.com/projects/p/connect?token=x',
    'https://harbor.example.com/projects/p/connect?token=x#fragment',
  ])('rejects unsafe connect URL %s with local exit code 2', input => {
    expect(() => validateHarborConnectUrl(input)).toThrow(
      expect.objectContaining({ exitCode: 2 }),
    );
  });
});

describe('prepareHarborConnection', () => {
  it('requires the current directory to equal the worktree root', async () => {
    const fetch = vi.fn();
    const runGit = gitRunner({
      'rev-parse --show-toplevel': {
        exitCode: 0,
        stdout: 'Q:\\repo',
      },
    });

    await expect(
      prepareHarborConnection(connectUrl, 'Q:\\repo\\packages\\core', runGit),
    ).rejects.toMatchObject({ exitCode: 2 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a non-Git directory', async () => {
    await expect(
      prepareHarborConnection(
        connectUrl,
        'Q:\\not-a-repo',
        gitRunner({
          'rev-parse --show-toplevel': { exitCode: 128, stdout: '' },
        }),
      ),
    ).rejects.toMatchObject({ exitCode: 2 });
  });
});

describe('connectPreparedProjectToHarbor', () => {
  it('normalizes the origin, warns without blocking, and sends one POST', async () => {
    const fetch = vi.fn(async () => successResponse());
    const warnings: string[] = [];
    const runGit = gitRunner({
      'cat-file -e HEAD:.shipbench/config.json': {
        exitCode: 128,
        stdout: '',
      },
      'status --porcelain=v1 --untracked-files=all -- .shipbench': {
        exitCode: 0,
        stdout: '?? .shipbench/config.json',
      },
      'rev-parse --abbrev-ref --symbolic-full-name @{upstream}': {
        exitCode: 128,
        stdout: '',
      },
    });

    await expect(
      connectPreparedProjectToHarbor({
        prepared: { connectUrl, cwd: 'Q:\\repo' },
        runGit,
        fetch: fetch as typeof globalThis.fetch,
        warn: line => warnings.push(line),
        operationStatus: 'ShipBench initialization completed.',
      }),
    ).resolves.toBe('Repository connected.');

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      connectUrl,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          remote_url: 'https://github.com/shipbench/shipbench',
        }),
      }),
    );
    expect(warnings.join('\n')).toMatch(/absent from HEAD/i);
    expect(warnings.join('\n')).toMatch(/uncommitted/i);
    expect(warnings.join('\n')).toMatch(/no upstream/i);
  });

  it('warns when the branch is ahead of its upstream', async () => {
    const warnings: string[] = [];

    await connectPreparedProjectToHarbor({
      prepared: { connectUrl, cwd: 'Q:\\repo' },
      runGit: gitRunner({
        'rev-list --count @{upstream}..HEAD': {
          exitCode: 0,
          stdout: '2',
        },
      }),
      fetch: vi.fn(async () => successResponse()) as typeof globalThis.fetch,
      warn: line => warnings.push(line),
      operationStatus: 'ShipBench project files remain unchanged.',
    });

    expect(warnings.join('\n')).toMatch(/2 commits ahead/i);
  });

  it.each([
    ['', 'missing origin'],
    ['https://gitlab.com/shipbench/shipbench', 'unsupported origin'],
  ])('rejects %s before fetch (%s)', async remoteUrl => {
    const fetch = vi.fn();
    const result =
      remoteUrl === ''
        ? { exitCode: 2, stdout: '' }
        : { exitCode: 0, stdout: remoteUrl };

    await expect(
      connectPreparedProjectToHarbor({
        prepared: { connectUrl, cwd: 'Q:\\repo' },
        runGit: gitRunner({ 'remote get-url origin': result }),
        fetch: fetch as typeof globalThis.fetch,
        warn: () => {},
        operationStatus: 'ShipBench project files remain unchanged.',
      }),
    ).rejects.toMatchObject({ exitCode: 2 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses exit code 3 for a definitive Harbor rejection', async () => {
    await expect(
      connectPreparedProjectToHarbor({
        prepared: { connectUrl, cwd: 'Q:\\repo' },
        runGit: gitRunner(),
        fetch: vi.fn(async () =>
          Response.json(
            {
              code: 'CONNECT_TOKEN_EXPIRED',
              error: 'Unsafe reflected server text.',
            },
            { status: 410 },
          ),
        ) as typeof globalThis.fetch,
        warn: () => {},
        operationStatus: 'ShipBench initialization completed.',
      }),
    ).rejects.toMatchObject({
      exitCode: 3,
      message: expect.stringContaining('definitively rejected'),
    });
  });

  it.each([
    [
      'transport failure',
      vi.fn(async () => Promise.reject(new Error(connectUrl))),
    ],
    [
      'server failure',
      vi.fn(async () =>
        Response.json(
          { code: 'INTERNAL_ERROR', error: connectUrl },
          { status: 500 },
        ),
      ),
    ],
    [
      'malformed success',
      vi.fn(async () => new Response('not json', { status: 200 })),
    ],
  ])('uses exit code 4 for an indeterminate %s', async (_label, fetch) => {
    const request = connectPreparedProjectToHarbor({
      prepared: { connectUrl, cwd: 'Q:\\repo' },
      runGit: gitRunner(),
      fetch: fetch as typeof globalThis.fetch,
      warn: () => {},
      operationStatus: 'ShipBench initialization completed.',
    });

    await expect(request).rejects.toMatchObject({
      exitCode: 4,
      message: expect.not.stringContaining('secret-token'),
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('redacts a reflected signed URL and token from success output', async () => {
    const message = await connectPreparedProjectToHarbor({
      prepared: { connectUrl, cwd: 'Q:\\repo' },
      runGit: gitRunner(),
      fetch: vi.fn(async () =>
        successResponse(`Connected via ${connectUrl}; token=secret-token.`),
      ) as typeof globalThis.fetch,
      warn: () => {},
      operationStatus: 'ShipBench project files remain unchanged.',
    });

    expect(message).not.toContain(connectUrl);
    expect(message).not.toContain('secret-token');
    expect(message).toContain('[redacted connect URL]');
  });

  it('accepts an idempotent replay response as success', async () => {
    const message = await connectPreparedProjectToHarbor({
      prepared: { connectUrl, cwd: 'Q:\\repo' },
      runGit: gitRunner(),
      fetch: vi.fn(async () =>
        Response.json({
          message: 'Repository was already connected.',
          already_connected: true,
        }),
      ) as typeof globalThis.fetch,
      warn: () => {},
      operationStatus: 'ShipBench project files remain unchanged.',
    });

    expect(message).toBe('Repository was already connected.');
  });
});

describe('CliExitError', () => {
  it('carries the stable process outcome', () => {
    expect(new CliExitError('local', 2)).toMatchObject({ exitCode: 2 });
    expect(new CliExitError('rejected', 3)).toMatchObject({ exitCode: 3 });
    expect(new CliExitError('unknown', 4)).toMatchObject({ exitCode: 4 });
  });
});
