import type { Task } from '@shipbench/core';
import { describe, expect, it } from 'vitest';
import { searchBoardTasks } from './boardSearch.js';

const task = (
  slug: string,
  overrides: Partial<Omit<Task, 'frontmatter'>> & {
    frontmatter?: Partial<Task['frontmatter']>;
  } = {},
): Task => ({
  slug,
  body: '',
  comments: [],
  ...overrides,
  frontmatter: {
    title: slug.replace(/-/g, ' '),
    status: 'todo',
    created: '2026-06-01T00:00:00.000Z',
    updated: '2026-06-01T00:00:00.000Z',
    ...overrides.frontmatter,
  },
});

const slugs = (tasks: Task[]) => tasks.map(entry => entry.slug);

describe('searchBoardTasks', () => {
  it('returns every task with no context for a blank query', () => {
    const tasks = [task('a'), task('b')];
    const result = searchBoardTasks(tasks, '   ');
    expect(slugs(result.tasks)).toEqual(['a', 'b']);
    expect(result.contextBySlug.size).toBe(0);
  });

  it('still matches title, slug, assignee, and tags case-insensitively', () => {
    const tasks = [
      task('setup-auth', {
        frontmatter: { title: 'Setup auth', tags: ['auth'] },
      }),
      task('write-docs', {
        frontmatter: { title: 'Write docs', assignee: 'Ada', tags: ['docs'] },
      }),
    ];

    expect(slugs(searchBoardTasks(tasks, 'AUTH').tasks)).toEqual([
      'setup-auth',
    ]);
    expect(slugs(searchBoardTasks(tasks, 'ada').tasks)).toEqual(['write-docs']);
    // The hyphen makes this a slug-only hit; the title says "Write docs".
    expect(slugs(searchBoardTasks(tasks, 'write-docs').tasks)).toEqual([
      'write-docs',
    ]);
    expect(searchBoardTasks(tasks, 'missing').tasks).toEqual([]);
  });

  it('finds a phrase that appears only in a description and says where', () => {
    const tasks = [
      task('tighten-copy', {
        body: 'Keep the hero copy concise so it reads in one breath.',
      }),
      task('unrelated'),
    ];

    const result = searchBoardTasks(tasks, 'concise');
    expect(slugs(result.tasks)).toEqual(['tighten-copy']);
    expect(result.contextBySlug.get('tighten-copy')).toMatchObject({
      matched_fields: ['body'],
      snippet: 'Keep the hero copy concise so it reads in one breath.',
    });
  });

  it('finds a recorded decision in a Task Update with its timestamp', () => {
    const tasks = [
      task('pick-a-queue', {
        comments: [
          { timestamp: '2026-09-01T10:00:00.000Z', text: 'Opened the spike.' },
          {
            timestamp: '2026-09-07T19:32:52.397Z',
            text: 'Chose SQS over Kafka because nobody wants to run brokers.',
          },
        ],
      }),
    ];

    const match = searchBoardTasks(tasks, 'kafka').contextBySlug.get(
      'pick-a-queue',
    );
    expect(match?.update_matches).toEqual([
      {
        index: 1,
        timestamp: '2026-09-07T19:32:52.397Z',
        snippet: 'Chose SQS over Kafka because nobody wants to run brokers.',
      },
    ]);
  });

  it('requires every term, letting terms land in different fields', () => {
    const tasks = [
      task('claude-task', {
        frontmatter: { assignee: 'claude' },
        body: 'Use OAuth for sign-in.',
      }),
      task('human-task', {
        frontmatter: { assignee: 'human' },
        body: 'Use OAuth for sign-in.',
      }),
    ];

    expect(slugs(searchBoardTasks(tasks, 'claude oauth').tasks)).toEqual([
      'claude-task',
    ]);
  });

  it('shares core’s phrase grammar', () => {
    const tasks = [
      task('phrase', { body: 'We settled on token exchange.' }),
      task('scattered', { body: 'The token is used for the exchange.' }),
    ];

    expect(slugs(searchBoardTasks(tasks, '"token exchange"').tasks)).toEqual([
      'phrase',
    ]);
    expect(slugs(searchBoardTasks(tasks, 'token exchange').tasks)).toEqual([
      'phrase',
      'scattered',
    ]);
  });

  it('keeps board order instead of relevance order', () => {
    const tasks = [
      task('mentions-it', { body: 'Something about widgets.' }),
      task('widgets-in-title', { frontmatter: { title: 'Widgets' } }),
    ];

    expect(slugs(searchBoardTasks(tasks, 'widgets').tasks)).toEqual([
      'mentions-it',
      'widgets-in-title',
    ]);
  });

  it('gives no context when the card already shows every term', () => {
    const tasks = [
      task('setup-auth', {
        frontmatter: { title: 'Setup auth', tags: ['backend'] },
        body: 'Auth for the backend.',
      }),
    ];

    expect(searchBoardTasks(tasks, 'auth').contextBySlug.size).toBe(0);
    expect(searchBoardTasks(tasks, 'auth backend').contextBySlug.size).toBe(0);
  });

  it('gives context when any term is found only in the content', () => {
    const tasks = [
      task('setup-auth', {
        frontmatter: { title: 'Setup auth' },
        body: 'Rotate the refresh token weekly.',
      }),
    ];

    expect(
      searchBoardTasks(tasks, 'auth refresh').contextBySlug.get('setup-auth')
        ?.snippet,
    ).toBe('Rotate the refresh token weekly.');
  });

  it('uses the given card face for the matching extras', () => {
    const tasks = [task('filed', { frontmatter: { status: 'done' } })];
    const archiveFace = (entry: Task) => [entry.slug, entry.frontmatter.status];

    expect(searchBoardTasks(tasks, 'done').tasks).toEqual([]);
    expect(slugs(searchBoardTasks(tasks, 'done', archiveFace).tasks)).toEqual([
      'filed',
    ]);
  });
});
