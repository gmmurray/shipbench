import type { ReadableStorageAdapter } from '../types.js';

export interface GitHubAdapterOptions {
  owner: string;
  repo: string;
  token: string;
  branch?: string;
  /** Inject a custom fetch (useful for tests). Defaults to global fetch. */
  fetch?: typeof fetch;
  /** Override the commit author message prefix. */
  commitMessagePrefix?: string;
}

export class GitHubApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly operation: string;
  readonly path: string;

  constructor(options: {
    status: number;
    statusText: string;
    operation: string;
    path: string;
    body?: string;
  }) {
    const { status, statusText, operation, path, body } = options;
    super(
      `GitHubAdapter.${operation}: ${status} ${statusText} for "${path}"${
        body ? ` — ${body}` : ''
      }`,
    );
    this.name = 'GitHubApiError';
    this.status = status;
    this.statusText = statusText;
    this.operation = operation;
    this.path = path;
  }
}

interface GitHubFileResponse {
  type: 'file';
  content: string;
  encoding: 'base64';
  sha: string;
  name: string;
  path: string;
}

interface GitHubDirEntry {
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  name: string;
  path: string;
  sha: string;
}

const API_BASE = 'https://api.github.com';

// Cross-runtime UTF-8 ⇄ base64. Works in Node 20+, Cloudflare Workers, and browsers.
function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToUtf8(s: string): string {
  // GitHub returns base64 wrapped to 60 columns; strip whitespace before decode.
  const bin = atob(s.replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

/**
 * GitHub Contents API adapter.
 *
 * Implements the read-only `StorageAdapter` surface (satisfies `BoardAPI`
 * consumption in Harbor's remote mode). `writeFile` / `writeFiles` are
 * concrete methods used only by Harbor's onboarding flows (seed commits,
 * workspace init, config recovery) — never wired up to the interface
 * because ongoing task CRUD never routes through GitHub. Delete is
 * intentionally unimplemented: nothing in the current or planned
 * architecture ever deletes via the GitHub API.
 */
export class GitHubAdapter implements ReadableStorageAdapter {
  private owner: string;
  private repo: string;
  private token: string;
  private branch: string | undefined;
  private fetchImpl: typeof fetch;
  private commitMessagePrefix: string;

  constructor(options: GitHubAdapterOptions) {
    this.owner = options.owner;
    this.repo = options.repo;
    this.token = options.token;
    this.branch = options.branch;
    // Call the runtime function through a closure so it is not invoked as
    // `this.fetchImpl(...)`. Workerd's native fetch rejects an incorrect
    // receiver with `TypeError: Illegal invocation` before an HTTP response
    // exists, while ordinary test doubles generally tolerate it.
    const fetchImpl = options.fetch ?? fetch;
    this.fetchImpl = (input, init) => fetchImpl(input, init);
    this.commitMessagePrefix = options.commitMessagePrefix ?? 'shipbench:';
  }

  private contentsUrl(path: string): string {
    return `${API_BASE}/repos/${this.owner}/${this.repo}/contents/${encodePath(path)}`;
  }

  private contentsReadUrl(path: string): string {
    const url = this.contentsUrl(path);
    return this.branch === undefined
      ? url
      : `${url}?ref=${encodeURIComponent(this.branch)}`;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': '@shipbench/core',
    };
  }

  private async errorFromResponse(
    res: Response,
    operation: string,
    path: string,
  ): Promise<GitHubApiError> {
    let body = '';
    try {
      body = await res.text();
    } catch {}
    return new GitHubApiError({
      status: res.status,
      statusText: res.statusText,
      operation,
      path,
      body,
    });
  }

  private async readFileContent(
    path: string,
    missingAsNull: boolean,
  ): Promise<string | null> {
    const url = this.contentsReadUrl(path);
    const res = await this.fetchImpl(url, { headers: this.headers() });
    if (missingAsNull && res.status === 404) return null;
    if (!res.ok) throw await this.errorFromResponse(res, 'readFile', path);

    const json = (await res.json()) as GitHubFileResponse | GitHubDirEntry[];
    if (Array.isArray(json)) {
      throw new Error(
        `GitHubAdapter.readFile: "${path}" is a directory, not a file.`,
      );
    }
    if (json.encoding !== 'base64') {
      throw new Error(
        `GitHubAdapter.readFile: unexpected encoding "${json.encoding}" for "${path}".`,
      );
    }
    return base64ToUtf8(json.content);
  }

  async readFile(path: string): Promise<string> {
    const content = await this.readFileContent(path, false);
    return content as string;
  }

  async readFileIfExists(path: string): Promise<string | null> {
    return this.readFileContent(path, true);
  }

  /** Returns the SHA of an existing file, or undefined if it does not exist. */
  private async getSha(path: string): Promise<string | undefined> {
    const url = this.contentsReadUrl(path);
    const res = await this.fetchImpl(url, { headers: this.headers() });
    if (res.status === 404) return undefined;
    if (!res.ok) throw await this.errorFromResponse(res, 'getSha', path);

    const json = (await res.json()) as GitHubFileResponse | GitHubDirEntry[];
    if (Array.isArray(json)) {
      throw new Error(
        `GitHubAdapter.getSha: "${path}" is a directory, not a file.`,
      );
    }
    return json.sha;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const sha = await this.getSha(path);
    const body: Record<string, unknown> = {
      message: `${this.commitMessagePrefix} ${sha ? 'update' : 'create'} ${path}`,
      content: utf8ToBase64(content),
    };
    if (this.branch !== undefined) body.branch = this.branch;
    if (sha) body.sha = sha;

    const res = await this.fetchImpl(this.contentsUrl(path), {
      method: 'PUT',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await this.errorFromResponse(res, 'writeFile', path);
  }

  async listFiles(directory: string): Promise<string[]> {
    const url = this.contentsReadUrl(directory);
    const res = await this.fetchImpl(url, { headers: this.headers() });
    // Missing directory ⇒ empty listing (graceful, matches FsAdapter).
    if (res.status === 404) return [];
    if (!res.ok)
      throw await this.errorFromResponse(res, 'listFiles', directory);

    const json = (await res.json()) as GitHubFileResponse | GitHubDirEntry[];
    if (!Array.isArray(json)) {
      throw new Error(
        `GitHubAdapter.listFiles: "${directory}" is a file, not a directory.`,
      );
    }
    return json.filter(e => e.type === 'file').map(e => e.name);
  }

  async readFiles(paths: string[]): Promise<Map<string, string>> {
    // Independent reads — safe to parallelize.
    const entries = await Promise.all(
      paths.map(async p => [p, await this.readFile(p)] as const),
    );
    return new Map(entries);
  }

  async writeFiles(files: Map<string, string>): Promise<void> {
    // Sequential to avoid racing on concurrent commits to the same branch.
    // Batch-via-Trees-API is a deferred optimization.
    for (const [path, content] of files) {
      await this.writeFile(path, content);
    }
  }
}
