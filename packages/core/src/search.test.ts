import { describe, expect, it } from 'vitest';
import { searchTasks } from './search.js';
import type { Task } from './types.js';

function task(
  slug: string,
  title: string,
  options: { tags?: string[]; body?: string } = {},
): Task {
  return {
    slug,
    frontmatter: {
      title,
      status: 'todo',
      tags: options.tags,
      created: '2026-07-24T00:00:00.000Z',
      updated: '2026-07-24T00:00:00.000Z',
    },
    body: options.body ?? '',
    comments: [],
  };
}

describe('searchTasks', () => {
  it('matches case-insensitive substrings in titles, tags, and bodies', () => {
    const tasks = [
      task('title-match', 'Configure OAuth callback'),
      task('tag-match', 'Configure login', { tags: ['GitHub-OAuth'] }),
      task('body-match', 'Document login', {
        body: 'Explain the OAUTH authorization flow.',
      }),
    ];

    expect(searchTasks(tasks, 'oauth')).toEqual([
      {
        slug: 'title-match',
        title: 'Configure OAuth callback',
        matched_fields: ['title'],
      },
      {
        slug: 'tag-match',
        title: 'Configure login',
        matched_fields: ['tags'],
      },
      {
        slug: 'body-match',
        title: 'Document login',
        matched_fields: ['body'],
        snippet: 'Explain the OAUTH authorization flow.',
      },
    ]);
  });

  it('reports every matching field in a stable order', () => {
    const matches = searchTasks(
      [
        task('everywhere', 'Search tasks', {
          tags: ['search'],
          body: 'Add a search command.',
        }),
      ],
      'search',
    );

    expect(matches[0]?.matched_fields).toEqual(['title', 'tags', 'body']);
  });

  it('ANDs whitespace-delimited terms across fields in any order', () => {
    const tasks = [
      task('split-match', 'Report command errors', {
        tags: ['CLI'],
        body: 'Improve the output handling.',
      }),
      task('partial-match', 'Report command errors'),
    ];

    const expected = [
      {
        slug: 'split-match',
        title: 'Report command errors',
        matched_fields: ['title', 'tags', 'body'],
        snippet: 'Improve the output handling.',
      },
    ];

    expect(searchTasks(tasks, 'errors CLI handling')).toEqual(expected);
    expect(searchTasks(tasks, 'handling errors CLI')).toEqual(expected);
  });

  it('keeps substring matching within each term', () => {
    const tasks = [
      task('explicit', 'Make output explicit'),
      task('decision', 'Record the decision'),
      task('specific', 'Use a specific example'),
      task('unrelated', 'Run the workflow'),
    ];

    expect(searchTasks(tasks, 'ci').map(match => match.slug)).toEqual([
      'explicit',
      'decision',
      'specific',
    ]);
  });

  it('returns a bounded, whitespace-normalized snippet around a body match', () => {
    const prefix = 'prefix '.repeat(15);
    const suffix = ' suffix'.repeat(20);

    const [match] = searchTasks(
      [task('long-body', 'Long body', { body: `${prefix}\nNeedle${suffix}` })],
      'needle',
    );

    expect(match?.snippet).toContain('Needle');
    expect(match?.snippet).not.toContain('\n');
    expect(match?.snippet).toMatch(/^….*…$/);
  });

  it('anchors multi-term snippets at the earliest body match', () => {
    const prefix = 'prefix '.repeat(15);
    const suffix = ' suffix'.repeat(20);
    const tasks = [
      task('multi-term-body', 'Long body', {
        body: `${prefix}Alpha before omega${suffix}`,
      }),
    ];

    const [match] = searchTasks(tasks, 'omega alpha');

    expect(match?.snippet).toContain('Alpha before omega');
    expect(match?.snippet).toEqual(
      searchTasks(tasks, 'alpha omega')[0]?.snippet,
    );
  });

  it('returns no matches for a miss or a blank query', () => {
    const tasks = [task('unrelated', 'Unrelated task', { tags: ['docs'] })];

    expect(searchTasks(tasks, 'oauth')).toEqual([]);
    expect(searchTasks(tasks, '   ')).toEqual([]);
  });
});
