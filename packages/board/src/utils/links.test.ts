import { describe, expect, it } from 'vitest';
import { classifyLink } from './links.js';

describe('classifyLink', () => {
  it('resolves an explicitly relative path against the task directory', () => {
    expect(classifyLink('../../docs/spec.md')).toEqual({
      kind: 'repo',
      path: 'docs/spec.md',
      suffix: '',
      taskSlug: null,
    });
  });

  it('resolves a bare path against the repo root, not the task directory', () => {
    // `.shipbench/tasks/apps/site/index.astro` is what Markdown semantics say
    // and never what an author meant.
    expect(classifyLink('apps/site/index.astro')).toMatchObject({
      kind: 'repo',
      path: 'apps/site/index.astro',
    });
  });

  it('treats a root-relative path as repo-root-relative', () => {
    expect(classifyLink('/docs/spec.md')).toMatchObject({
      kind: 'repo',
      path: 'docs/spec.md',
    });
  });

  it('clamps traversal above the repo root', () => {
    expect(classifyLink('../../../../../../etc/passwd')).toMatchObject({
      kind: 'repo',
      path: 'etc/passwd',
    });
  });

  it('keeps query and hash separate from the path', () => {
    expect(classifyLink('../../docs/spec.md#caching')).toEqual({
      kind: 'repo',
      path: 'docs/spec.md',
      suffix: '#caching',
      taskSlug: null,
    });
  });

  it('decodes percent-encoded path segments', () => {
    expect(classifyLink('../../docs/my%20notes.md')).toMatchObject({
      path: 'docs/my notes.md',
    });
  });

  it('recognizes a sibling task file by slug', () => {
    expect(classifyLink('./build-api.md')).toEqual({
      kind: 'repo',
      path: '.shipbench/tasks/build-api.md',
      suffix: '',
      taskSlug: 'build-api',
    });
  });

  it('recognizes a task file reached from elsewhere in the repo', () => {
    expect(classifyLink('.shipbench/tasks/build-api.md')).toMatchObject({
      taskSlug: 'build-api',
    });
  });

  it('does not treat an archived task as a live one', () => {
    expect(classifyLink('./archive/build-api.md')).toMatchObject({
      path: '.shipbench/tasks/archive/build-api.md',
      taskSlug: null,
    });
  });

  it('classifies http(s) and protocol-relative URLs as external', () => {
    expect(classifyLink('https://shipbench.dev')).toEqual({ kind: 'external' });
    expect(classifyLink('http://localhost:4321')).toEqual({ kind: 'external' });
    expect(classifyLink('//shipbench.dev/docs')).toEqual({ kind: 'external' });
  });

  it('leaves anchors, other schemes, and empty hrefs to the default renderer', () => {
    expect(classifyLink('#task-updates')).toEqual({ kind: 'default' });
    expect(classifyLink('mailto:solo@example.com')).toEqual({
      kind: 'default',
    });
    // `defaultUrlTransform` blanks unsafe schemes before we ever see them.
    expect(classifyLink('')).toEqual({ kind: 'default' });
    expect(classifyLink('   ')).toEqual({ kind: 'default' });
  });
});
