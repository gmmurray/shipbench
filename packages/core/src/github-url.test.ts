import { describe, expect, it } from 'vitest';
import {
  normalizeGithubRemoteUrl,
  normalizeGithubUrl,
  parseGithubRemoteUrl,
  parseGithubUrl,
} from './github-url.js';

describe('parseGithubUrl', () => {
  it('accepts canonical GitHub HTTPS repository URLs', () => {
    expect(parseGithubUrl('https://github.com/shipbench/harbor')).toEqual({
      owner: 'shipbench',
      repo: 'harbor',
    });
    expect(
      parseGithubUrl(' https://github.com/shipbench/harbor.git/ '),
    ).toEqual({
      owner: 'shipbench',
      repo: 'harbor',
    });
  });

  it('rejects unsupported protocols, hosts, and path shapes', () => {
    expect(parseGithubUrl('http://github.com/shipbench/harbor')).toBeNull();
    expect(parseGithubUrl('https://gitlab.com/shipbench/harbor')).toBeNull();
    expect(
      parseGithubUrl('https://github.com/shipbench/harbor/issues'),
    ).toBeNull();
    expect(parseGithubUrl('https://github.com/./harbor')).toBeNull();
  });
});

describe('parseGithubRemoteUrl', () => {
  it('accepts the endpoint contract remote forms', () => {
    expect(
      parseGithubRemoteUrl('https://github.com/shipbench/harbor.git'),
    ).toEqual({ owner: 'shipbench', repo: 'harbor' });
    expect(parseGithubRemoteUrl('git@github.com:shipbench/harbor.git')).toEqual(
      { owner: 'shipbench', repo: 'harbor' },
    );
    expect(
      parseGithubRemoteUrl('ssh://git@github.com/shipbench/harbor.git'),
    ).toEqual({ owner: 'shipbench', repo: 'harbor' });
  });

  it('rejects other hosts, SSH users, credentials, and URL decorations', () => {
    expect(
      parseGithubRemoteUrl('git@gitlab.com:shipbench/harbor.git'),
    ).toBeNull();
    expect(
      parseGithubRemoteUrl('ssh://owner@github.com/shipbench/harbor.git'),
    ).toBeNull();
    expect(
      parseGithubRemoteUrl('https://user@github.com/shipbench/harbor'),
    ).toBeNull();
    expect(
      parseGithubRemoteUrl('ssh://git@github.com/shipbench/harbor.git?x=1'),
    ).toBeNull();
  });
});

describe('GitHub URL normalization', () => {
  it('normalizes HTTPS and SSH forms to canonical HTTPS', () => {
    expect(normalizeGithubUrl('https://github.com/shipbench/harbor.git/')).toBe(
      'https://github.com/shipbench/harbor',
    );
    expect(
      normalizeGithubRemoteUrl('git@github.com:shipbench/harbor.git'),
    ).toBe('https://github.com/shipbench/harbor');
  });

  it('returns null for unsupported inputs', () => {
    expect(normalizeGithubUrl('not a URL')).toBeNull();
    expect(
      normalizeGithubRemoteUrl('git@example.com:owner/repo.git'),
    ).toBeNull();
  });
});
