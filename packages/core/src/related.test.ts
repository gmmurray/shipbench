import { describe, expect, it } from 'vitest';
import { createRelatedIndex, relatedSlugs } from './related.js';
import type { Task } from './types.js';

function task(slug: string, related?: unknown, status = 'todo'): Task {
  return {
    slug,
    frontmatter: {
      title: `Title of ${slug}`,
      status,
      ...(related !== undefined ? { related } : {}),
      created: '2026-01-01T00:00:00Z',
      updated: '2026-01-01T00:00:00Z',
    } as Task['frontmatter'],
    body: '',
    comments: [],
  };
}

describe('relatedSlugs', () => {
  it('reads the list as written, deduped and trimmed', () => {
    expect(relatedSlugs(task('a', ['b', ' c ', 'b']))).toEqual(['b', 'c']);
  });

  it('reads a malformed value as nothing', () => {
    expect(relatedSlugs(task('a', 'b'))).toEqual([]);
    expect(relatedSlugs(task('a', [1, 'b', null]))).toEqual(['b']);
    expect(relatedSlugs(task('a'))).toEqual([]);
  });
});

describe('createRelatedIndex', () => {
  it('shows an association from both sides', () => {
    const a = task('a', ['b']);
    const b = task('b');
    const relatedOf = createRelatedIndex({ tasks: [a, b] });

    expect(relatedOf(a)).toEqual([
      {
        slug: 'b',
        direction: 'outgoing',
        title: 'Title of b',
        status: 'todo',
        archived: false,
      },
    ]);
    expect(relatedOf(b)).toEqual([
      {
        slug: 'a',
        direction: 'incoming',
        title: 'Title of a',
        status: 'todo',
        archived: false,
      },
    ]);
  });

  it('shows an association recorded on both files once', () => {
    const a = task('a', ['b']);
    const b = task('b', ['a']);
    const relatedOf = createRelatedIndex({ tasks: [a, b] });

    expect(relatedOf(a).map(entry => [entry.slug, entry.direction])).toEqual([
      ['b', 'both'],
    ]);
    expect(relatedOf(b).map(entry => [entry.slug, entry.direction])).toEqual([
      ['a', 'both'],
    ]);
  });

  it('labels an archived target before the archive is loaded', () => {
    const a = task('a', ['spike']);
    const relatedOf = createRelatedIndex({
      tasks: [a],
      archivedSlugs: ['spike'],
    });

    expect(relatedOf(a)).toEqual([
      {
        slug: 'spike',
        direction: 'outgoing',
        title: null,
        status: null,
        archived: true,
      },
    ]);
  });

  it('resolves a loaded archived target and its incoming edges', () => {
    const a = task('a');
    const spike = task('spike', ['a'], 'done');
    const relatedOf = createRelatedIndex({
      tasks: [a],
      archivedTasks: [spike],
    });

    expect(relatedOf(a)).toEqual([
      {
        slug: 'spike',
        direction: 'incoming',
        title: 'Title of spike',
        status: 'done',
        archived: true,
      },
    ]);
  });

  it('reports a target matching nothing as unresolved', () => {
    const a = task('a', ['ghost']);

    expect(createRelatedIndex({ tasks: [a] })(a)).toEqual([
      {
        slug: 'ghost',
        direction: 'outgoing',
        title: null,
        status: null,
        archived: false,
      },
    ]);
  });

  it('ignores a self-reference written by hand', () => {
    const a = task('a', ['a']);
    expect(createRelatedIndex({ tasks: [a] })(a)).toEqual([]);
  });
});
