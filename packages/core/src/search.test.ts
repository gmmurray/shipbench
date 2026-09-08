import { describe, expect, it } from 'vitest';
import { searchTasks } from './search.js';
import type { Task, TaskComment, UnreadableUpdates } from './types.js';

function task(
  slug: string,
  title: string,
  options: {
    tags?: string[];
    body?: string;
    status?: string;
    comments?: TaskComment[];
    unreadableUpdates?: UnreadableUpdates;
  } = {},
): Task {
  return {
    slug,
    frontmatter: {
      title,
      status: options.status ?? 'todo',
      tags: options.tags,
      created: '2026-07-24T00:00:00.000Z',
      updated: '2026-07-24T00:00:00.000Z',
    },
    body: options.body ?? '',
    comments: options.comments ?? [],
    ...(options.unreadableUpdates
      ? { unreadableUpdates: options.unreadableUpdates }
      : {}),
  };
}

describe('searchTasks', () => {
  it('matches case-insensitive substrings in titles, tags, and bodies', () => {
    const tasks = [
      task('title-match', 'Configure OAuth callback'),
      task('tag-match', 'Configure login', { tags: ['GitHub-OAuth'] }),
      task('body-match', 'Document login', {
        body: 'Explain the OAUTH authorization flow.',
        status: 'in-progress',
      }),
    ];

    expect(searchTasks(tasks, 'oauth')).toEqual([
      {
        slug: 'title-match',
        title: 'Configure OAuth callback',
        status: 'todo',
        matched_fields: ['title'],
      },
      {
        slug: 'tag-match',
        title: 'Configure login',
        status: 'todo',
        matched_fields: ['tags'],
      },
      {
        slug: 'body-match',
        title: 'Document login',
        status: 'in-progress',
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
          comments: [
            { timestamp: '2026-07-24T12:00:00.000Z', text: 'Search decision.' },
          ],
        }),
      ],
      'search',
    );

    expect(matches[0]?.matched_fields).toEqual([
      'title',
      'tags',
      'body',
      'updates',
    ]);
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
        status: 'todo',
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

  it('finds rationale that appears only in a Task Updates entry', () => {
    const tasks = [
      task('recorded-decision', 'Pick a storage adapter', {
        body: 'Choose between filesystem and API adapters.',
        status: 'done',
        comments: [
          {
            timestamp: '2026-08-01T09:00:00.000Z',
            text: 'Went with the filesystem adapter first.',
          },
          {
            timestamp: '2026-08-02T09:00:00.000Z',
            text: 'Reversed course: the GitHub adapter ships first because Harbor needs it.',
          },
        ],
      }),
    ];

    const [match] = searchTasks(tasks, 'harbor');

    expect(match?.slug).toBe('recorded-decision');
    expect(match?.status).toBe('done');
    expect(match?.matched_fields).toEqual(['updates']);
    expect(match?.update_matches).toHaveLength(1);
    expect(match?.update_matches?.[0]).toMatchObject({
      index: 1,
      timestamp: '2026-08-02T09:00:00.000Z',
    });
    expect(match?.update_matches?.[0]?.snippet).toContain('Harbor needs it.');
  });

  it('matches a quarantined unreadable Updates section as an updates source', () => {
    const tasks = [
      task('broken-updates', 'Task with a broken log', {
        body: 'The description is intact.',
        unreadableUpdates: {
          text: '## Task Updates\n\nWe chose the flat layout to keep diffs readable.',
          reason: 'the section contains no entries.',
        },
      }),
    ];

    const [match] = searchTasks(tasks, 'diffs readable');

    expect(match?.matched_fields).toEqual(['updates']);
    expect(match?.update_matches).toHaveLength(1);
    expect(match?.update_matches?.[0]).toMatchObject({ unreadable: true });
    expect(match?.update_matches?.[0]?.snippet).toContain(
      'flat layout to keep diffs readable.',
    );
  });

  it('reports both a body match and an update match on the same task', () => {
    const tasks = [
      task('both', 'Rework the config resolver', {
        body: 'Deep-merge partial configs over defaults.',
        comments: [
          {
            timestamp: '2026-08-10T09:00:00.000Z',
            text: 'Kept the deep-merge after the partial-config regression.',
          },
        ],
      }),
    ];

    const [match] = searchTasks(tasks, 'merge');

    expect(match?.matched_fields).toEqual(['body', 'updates']);
    expect(match?.snippet).toContain('Deep-merge');
    expect(match?.update_matches?.[0]).toMatchObject({
      index: 0,
      timestamp: '2026-08-10T09:00:00.000Z',
    });
  });

  it('ranks a stronger field above a weaker one regardless of input order', () => {
    const tasks = [
      task('body-only', 'Unrelated heading', { body: 'Mentions oauth once.' }),
      task('tagged', 'Unrelated heading', { tags: ['oauth'] }),
      task('titled', 'Configure oauth'),
    ];

    expect(searchTasks(tasks, 'oauth').map(match => match.slug)).toEqual([
      'titled',
      'tagged',
      'body-only',
    ]);
  });

  it('rewards covering more of the query in the same field', () => {
    const tasks = [
      task('one-term', 'Handle oauth', { body: 'token exchange' }),
      task('both-terms', 'Handle oauth token', { body: 'unrelated' }),
    ];

    expect(
      searchTasks(tasks, 'oauth token').map(match => match.slug),
    ).toEqual(['both-terms', 'one-term']);
  });

  it('breaks a score tie toward the more recently updated task', () => {
    const older: Task = {
      ...task('older', 'Configure oauth'),
      frontmatter: {
        ...task('older', 'Configure oauth').frontmatter,
        updated: '2026-07-01T00:00:00.000Z',
      },
    };
    const newer: Task = {
      ...task('newer', 'Configure oauth'),
      frontmatter: {
        ...task('newer', 'Configure oauth').frontmatter,
        updated: '2026-08-01T00:00:00.000Z',
      },
    };

    expect(
      searchTasks([older, newer], 'oauth').map(match => match.slug),
    ).toEqual(['newer', 'older']);
    expect(
      searchTasks([newer, older], 'oauth').map(match => match.slug),
    ).toEqual(['newer', 'older']);
  });

  it('falls back to input order when score and recency tie', () => {
    const tasks = [
      task('first', 'Configure oauth'),
      task('second', 'Configure oauth'),
    ];

    expect(searchTasks(tasks, 'oauth').map(match => match.slug)).toEqual([
      'first',
      'second',
    ]);
  });

  it('returns no matches for a miss or a blank query', () => {
    const tasks = [task('unrelated', 'Unrelated task', { tags: ['docs'] })];

    expect(searchTasks(tasks, 'oauth')).toEqual([]);
    expect(searchTasks(tasks, '   ')).toEqual([]);
  });

  describe('whole-word matching', () => {
    const tasks = [
      task('explicit', 'Make output explicit'),
      task('decision', 'Record the decision'),
      task('ci-word', 'Wire up CI', { body: 'The CI pipeline runs on push.' }),
    ];

    it('matches a term only on word boundaries when enabled', () => {
      expect(
        searchTasks(tasks, 'ci', { wholeWord: true }).map(match => match.slug),
      ).toEqual(['ci-word']);
    });

    it('still matches substrings by default', () => {
      expect(
        searchTasks(tasks, 'ci')
          .map(match => match.slug)
          .sort(),
      ).toEqual(['ci-word', 'decision', 'explicit']);
    });

    it('anchors a boundary at each end, not between digits and letters', () => {
      const versioned = [task('v2', 'Ship v2', { body: 'The v2 rollout.' })];
      expect(
        searchTasks(versioned, 'v2', { wholeWord: true }).map(m => m.slug),
      ).toEqual(['v2']);
      expect(
        searchTasks(versioned, 'v', { wholeWord: true }),
      ).toEqual([]);
    });
  });

  describe('exact-phrase queries', () => {
    const tasks = [
      task('contiguous', 'Handle token exchange', {
        body: 'Implement the OAuth token exchange step.',
      }),
      task('scattered', 'Exchange rates', {
        body: 'Store the auth token separately from the exchange log.',
      }),
    ];

    it('requires a quoted run to match contiguously', () => {
      expect(
        searchTasks(tasks, '"token exchange"').map(match => match.slug),
      ).toEqual(['contiguous']);
    });

    it('still ANDs unquoted terms across the corpus', () => {
      expect(
        searchTasks(tasks, 'token exchange').map(match => match.slug).sort(),
      ).toEqual(['contiguous', 'scattered']);
    });

    it('matches a phrase that spans normalized whitespace', () => {
      const wrapped = [
        task('wrapped', 'Notes', { body: 'the token\n   exchange happens here' }),
      ];
      expect(
        searchTasks(wrapped, '"token exchange"').map(match => match.slug),
      ).toEqual(['wrapped']);
    });

    it('combines a phrase with a loose term', () => {
      expect(
        searchTasks(tasks, '"token exchange" oauth').map(match => match.slug),
      ).toEqual(['contiguous']);
    });

    it('ignores an empty or dangling quote', () => {
      expect(searchTasks(tasks, '""')).toEqual([]);
      expect(
        searchTasks(tasks, 'exchange "token').map(match => match.slug).sort(),
      ).toEqual(['contiguous', 'scattered']);
    });

    it('treats phrase punctuation literally', () => {
      const dotted = [
        task('dotted', 'Docs', { body: 'edit the docs/why.md file' }),
        task('spaced', 'Docs', { body: 'why a md file' }),
      ];
      expect(
        searchTasks(dotted, '"why.md"').map(match => match.slug),
      ).toEqual(['dotted']);
    });
  });
});
