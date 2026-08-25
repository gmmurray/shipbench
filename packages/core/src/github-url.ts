const GITHUB_URL_RE =
  /^https:\/\/github\.com\/([A-Za-z0-9][A-Za-z0-9._-]*)\/([A-Za-z0-9][A-Za-z0-9._-]*?)(?:\.git)?\/?$/;
const GITHUB_SCP_REMOTE_RE =
  /^git@github\.com:([A-Za-z0-9][A-Za-z0-9._-]*)\/([A-Za-z0-9][A-Za-z0-9._-]*?)(?:\.git)?$/;
const GITHUB_SSH_PATH_RE =
  /^\/([A-Za-z0-9][A-Za-z0-9._-]*)\/([A-Za-z0-9][A-Za-z0-9._-]*?)(?:\.git)?\/?$/;

export interface GithubRepositoryParts {
  owner: string;
  repo: string;
}

function validParts(owner: string, repo: string): boolean {
  return owner !== '.' && owner !== '..' && repo !== '.' && repo !== '..';
}

export function parseGithubUrl(input: string): GithubRepositoryParts | null {
  const match = GITHUB_URL_RE.exec(input.trim());
  if (!match) return null;

  const owner = match[1]!;
  const repo = match[2]!;
  return validParts(owner, repo) ? { owner, repo } : null;
}

export function parseGithubRemoteUrl(
  input: string,
): GithubRepositoryParts | null {
  const https = parseGithubUrl(input);
  if (https) return https;

  const trimmed = input.trim();
  const scpMatch = GITHUB_SCP_REMOTE_RE.exec(trimmed);
  if (scpMatch) {
    const owner = scpMatch[1]!;
    const repo = scpMatch[2]!;
    return validParts(owner, repo) ? { owner, repo } : null;
  }

  try {
    const url = new URL(trimmed);
    if (
      url.protocol !== 'ssh:' ||
      url.hostname !== 'github.com' ||
      url.username !== 'git' ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    const pathMatch = GITHUB_SSH_PATH_RE.exec(url.pathname);
    if (!pathMatch) return null;
    const owner = pathMatch[1]!;
    const repo = pathMatch[2]!;
    return validParts(owner, repo) ? { owner, repo } : null;
  } catch {
    return null;
  }
}

export function normalizeGithubUrl(input: string): string | null {
  const parsed = parseGithubUrl(input);
  return parsed ? `https://github.com/${parsed.owner}/${parsed.repo}` : null;
}

export function normalizeGithubRemoteUrl(input: string): string | null {
  const parsed = parseGithubRemoteUrl(input);
  return parsed ? `https://github.com/${parsed.owner}/${parsed.repo}` : null;
}
