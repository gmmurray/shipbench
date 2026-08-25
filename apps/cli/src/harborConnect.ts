import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { normalizeGithubRemoteUrl } from '@shipbench/core';

export type CliExitCode = 2 | 3 | 4;

export class CliExitError extends Error {
  constructor(
    message: string,
    public readonly exitCode: CliExitCode,
  ) {
    super(message);
    this.name = 'CliExitError';
  }
}

export interface GitCommandResult {
  exitCode: number;
  stdout: string;
}

export type GitRunner = (
  cwd: string,
  args: string[],
) => Promise<GitCommandResult>;

export interface PreparedHarborConnection {
  connectUrl: string;
  cwd: string;
}

interface HarborConnectResponse {
  message: string;
  already_connected?: boolean;
}

interface HarborConnectErrorResponse {
  code: string;
  error: string;
}

const HARBOR_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_REQUEST: 'Harbor rejected the connection request.',
  INVALID_REMOTE_URL:
    'The origin remote is not a supported GitHub repository URL.',
  INVALID_CONNECT_TOKEN: 'This connect URL is invalid.',
  PROJECT_NOT_FOUND: 'The Harbor project no longer exists.',
  PROJECT_ALREADY_CONNECTED:
    'This Harbor project is already connected to another repository.',
  REPOSITORY_ALREADY_CONNECTED:
    'This repository is already connected to another Harbor project.',
  CONNECT_TOKEN_USED:
    'This Harbor connect URL has already been used or superseded. Generate a new URL in Harbor.',
  CONNECT_TOKEN_EXPIRED:
    'This connect URL has expired. Generate a new URL in Harbor.',
};

export const runGitCommand: GitRunner = (cwd, args) =>
  new Promise(resolveResult => {
    execFile(
      'git',
      args,
      { cwd, encoding: 'utf8', windowsHide: true },
      (error, stdout) => {
        resolveResult({
          exitCode:
            typeof error?.code === 'number' ? error.code : error ? 1 : 0,
          stdout: stdout.trim(),
        });
      },
    );
  });

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (
    normalized === 'localhost' ||
    normalized === '::1' ||
    normalized === '[::1]'
  ) {
    return true;
  }
  const match = /^127\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(normalized);
  return (
    match?.slice(1).every(part => Number(part) >= 0 && Number(part) <= 255) ===
    true
  );
}

export function validateHarborConnectUrl(input: string): string {
  const trimmed = input.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new CliExitError(
      'The Harbor connect URL is invalid. Generate a fresh command in Harbor.',
      2,
    );
  }

  const allowedProtocol =
    parsed.protocol === 'https:' ||
    (parsed.protocol === 'http:' && isLoopbackHost(parsed.hostname));
  if (!allowedProtocol || parsed.username || parsed.password || parsed.hash) {
    throw new CliExitError(
      'The Harbor connect URL must use HTTPS, contain no credentials or fragment, and may use HTTP only on a loopback host.',
      2,
    );
  }
  return trimmed;
}

async function comparablePath(path: string): Promise<string> {
  let canonical: string;
  try {
    canonical = await realpath(path);
  } catch {
    canonical = resolve(path);
  }
  const normalized = canonical.replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

export async function prepareHarborConnection(
  input: string,
  cwd: string,
  runGit: GitRunner,
): Promise<PreparedHarborConnection> {
  const connectUrl = validateHarborConnectUrl(input);
  const rootResult = await runGit(cwd, ['rev-parse', '--show-toplevel']);
  if (rootResult.exitCode !== 0 || !rootResult.stdout) {
    throw new CliExitError(
      'The current directory is not a Git worktree. Run this command from a Git repository root.',
      2,
    );
  }
  const [gitRoot, currentDirectory] = await Promise.all([
    comparablePath(rootResult.stdout),
    comparablePath(cwd),
  ]);
  if (gitRoot !== currentDirectory) {
    throw new CliExitError(
      'Run this command from the Git worktree root, not a nested directory.',
      2,
    );
  }
  return { connectUrl, cwd };
}

function isHarborConnectResponse(
  value: unknown,
): value is HarborConnectResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as HarborConnectResponse).message === 'string' &&
    ((value as HarborConnectResponse).already_connected === undefined ||
      typeof (value as HarborConnectResponse).already_connected === 'boolean')
  );
}

function isHarborConnectErrorResponse(
  value: unknown,
): value is HarborConnectErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as HarborConnectErrorResponse).code === 'string' &&
    typeof (value as HarborConnectErrorResponse).error === 'string'
  );
}

function redactConnectCredential(text: string, connectUrl: string): string {
  let redacted = text.replaceAll(connectUrl, '[redacted connect URL]');
  try {
    const token = new URL(connectUrl).searchParams.get('token');
    if (token) redacted = redacted.replaceAll(token, '[redacted token]');
  } catch {
    // The URL was validated before this function runs.
  }
  return redacted;
}

async function collectGitVisibilityWarnings(
  cwd: string,
  runGit: GitRunner,
): Promise<string[]> {
  const [headConfig, status, upstream] = await Promise.all([
    runGit(cwd, ['cat-file', '-e', 'HEAD:.shipbench/config.json']),
    runGit(cwd, [
      'status',
      '--porcelain=v1',
      '--untracked-files=all',
      '--',
      '.shipbench',
    ]),
    runGit(cwd, [
      'rev-parse',
      '--abbrev-ref',
      '--symbolic-full-name',
      '@{upstream}',
    ]),
  ]);
  const warnings: string[] = [];

  if (headConfig.exitCode !== 0) {
    warnings.push(
      '.shipbench/config.json is absent from HEAD. Commit and push the ShipBench project before opening its board in Harbor.',
    );
  }
  if (status.exitCode !== 0) {
    warnings.push('Git could not inspect uncommitted ShipBench changes.');
  } else if (status.stdout) {
    warnings.push(
      'ShipBench files have uncommitted changes. Commit and push them so Harbor can see the current project.',
    );
  }

  if (upstream.exitCode !== 0 || !upstream.stdout) {
    warnings.push(
      'The current branch has no upstream. ShipBench files may not be pushed.',
    );
    return warnings;
  }

  const ahead = await runGit(cwd, ['rev-list', '--count', '@{upstream}..HEAD']);
  if (ahead.exitCode !== 0) {
    warnings.push('Git could not determine whether the branch is pushed.');
    return warnings;
  }
  const aheadCount = Number.parseInt(ahead.stdout, 10);
  if (Number.isInteger(aheadCount) && aheadCount > 0) {
    warnings.push(
      `The current branch is ${aheadCount} ${
        aheadCount === 1 ? 'commit' : 'commits'
      } ahead of its upstream. Push it so Harbor can see the current project.`,
    );
  }
  return warnings;
}

function indeterminateError(operationStatus: string): CliExitError {
  return new CliExitError(
    `${operationStatus} Harbor's result is unknown. Check the project in Harbor before retrying. No automatic retry was sent.`,
    4,
  );
}

export async function connectPreparedProjectToHarbor(options: {
  prepared: PreparedHarborConnection;
  runGit: GitRunner;
  fetch: typeof fetch;
  warn: (line: string) => void;
  operationStatus: string;
}): Promise<string> {
  const { prepared, runGit, fetch: fetchImpl, warn, operationStatus } = options;
  const remote = await runGit(prepared.cwd, ['remote', 'get-url', 'origin']);
  if (remote.exitCode !== 0 || !remote.stdout) {
    throw new CliExitError(
      `${operationStatus} No GitHub origin remote was found. Add an origin, then rerun the command. Harbor was not contacted.`,
      2,
    );
  }

  const normalizedRemote = normalizeGithubRemoteUrl(remote.stdout);
  if (!normalizedRemote) {
    throw new CliExitError(
      `${operationStatus} The origin is not a supported GitHub repository URL. Use a GitHub HTTPS, scp-style SSH, or ssh://git@github.com remote. Harbor was not contacted.`,
      2,
    );
  }

  for (const warning of await collectGitVisibilityWarnings(
    prepared.cwd,
    runGit,
  )) {
    warn(`Warning: ${warning}`);
  }

  let response: Response;
  try {
    response = await fetchImpl(prepared.connectUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ remote_url: normalizedRemote }),
    });
  } catch {
    throw indeterminateError(operationStatus);
  }

  if (response.status >= 500 || response.status < 200) {
    throw indeterminateError(operationStatus);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw indeterminateError(operationStatus);
  }

  if (response.ok) {
    if (!isHarborConnectResponse(body)) {
      throw indeterminateError(operationStatus);
    }
    return redactConnectCredential(body.message, prepared.connectUrl);
  }

  if (
    response.status < 400 ||
    response.status >= 500 ||
    !isHarborConnectErrorResponse(body)
  ) {
    throw indeterminateError(operationStatus);
  }

  const detail =
    HARBOR_ERROR_MESSAGES[body.code] ??
    `Harbor rejected this connection (HTTP ${response.status}).`;
  throw new CliExitError(
    `${operationStatus} Harbor definitively rejected the connection. ${detail}`,
    3,
  );
}
