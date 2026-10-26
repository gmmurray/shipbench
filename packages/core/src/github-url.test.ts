import { describe, expect, it } from 'vitest';
import { parseGithubRemoteUrl, parseGithubUrl } from './github-url.js';

describe('parseGithubUrl', () => {
  it('accepts canonical GitHub HTTPS repository URLs', () => {
    expect(parseGithubUrl('https://github.com/shipbench/shipbench')).toEqual({
      owner: 'shipbench',
      repo: 'shipbench',
    });
    expect(
      parseGithubUrl(' https://github.com/shipbench/shipbench.git/ '),
    ).toEqual({
      owner: 'shipbench',
      repo: 'shipbench',
    });
  });

  it('rejects unsupported protocols, hosts, and path shapes', () => {
    expect(parseGithubUrl('http://github.com/shipbench/shipbench')).toBeNull();
    expect(parseGithubUrl('https://gitlab.com/shipbench/shipbench')).toBeNull();
    expect(
      parseGithubUrl('https://github.com/shipbench/shipbench/issues'),
    ).toBeNull();
    expect(parseGithubUrl('https://github.com/./shipbench')).toBeNull();
  });
});

describe('parseGithubRemoteUrl', () => {
  it('accepts the endpoint contract remote forms', () => {
    expect(
      parseGithubRemoteUrl('https://github.com/shipbench/shipbench.git'),
    ).toEqual({ owner: 'shipbench', repo: 'shipbench' });
    expect(
      parseGithubRemoteUrl('git@github.com:shipbench/shipbench.git'),
    ).toEqual({ owner: 'shipbench', repo: 'shipbench' });
    expect(
      parseGithubRemoteUrl('ssh://git@github.com/shipbench/shipbench.git'),
    ).toEqual({ owner: 'shipbench', repo: 'shipbench' });
  });

  it('rejects other hosts, SSH users, credentials, and URL decorations', () => {
    expect(
      parseGithubRemoteUrl('git@gitlab.com:shipbench/shipbench.git'),
    ).toBeNull();
    expect(
      parseGithubRemoteUrl('ssh://owner@github.com/shipbench/shipbench.git'),
    ).toBeNull();
    expect(
      parseGithubRemoteUrl('https://user@github.com/shipbench/shipbench'),
    ).toBeNull();
    expect(
      parseGithubRemoteUrl('ssh://git@github.com/shipbench/shipbench.git?x=1'),
    ).toBeNull();
  });
});
