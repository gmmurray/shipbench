import { describe, expect, it } from 'vitest';
import { listAvailableTasks, listBlockedTasks } from './availability.js';
import { DEFAULT_CONFIG } from './defaults.js';
import type { Task, TaskFrontmatter } from './types.js';

function task(slug: string, fields: Partial<TaskFrontmatter> = {}): Task {
  return {
    slug,
    frontmatter: {
      title: slug,
      status: 'todo',
      priority: 'medium',
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-01T00:00:00.000Z',
      ...fields,
    },
    body: '',
    comments: [],
  };
}

describe('task availability filtering', () => {
  it('treats done and archived dependencies as satisfied', () => {
    const tasks = [
      task('standalone', { created: '2026-01-01T00:00:00.000Z' }),
      task('done-dependency', { status: 'done' }),
      task('live-dependency', { status: 'in-progress' }),
      task('needs-done', {
        depends_on: ['done-dependency'],
        created: '2026-01-02T00:00:00.000Z',
      }),
      task('needs-archive', {
        depends_on: ['archived-dependency'],
        created: '2026-01-03T00:00:00.000Z',
      }),
      task('needs-live', {
        depends_on: ['live-dependency'],
        created: '2026-01-04T00:00:00.000Z',
      }),
      task('non-actionable', { status: 'in-progress' }),
    ];
    const archivedTasks = [
      task('archived-dependency', { status: 'in-progress' }),
    ];

    expect(
      listAvailableTasks(tasks, DEFAULT_CONFIG, { archivedTasks }).map(
        candidate => candidate.slug,
      ),
    ).toEqual(['standalone', 'needs-done', 'needs-archive']);
  });

  it('accepts an archived dependency known only by its file slug', () => {
    const candidate = task('candidate', {
      depends_on: ['malformed-archive'],
    });

    expect(
      listAvailableTasks([candidate], DEFAULT_CONFIG, {
        archivedSlugs: ['malformed-archive'],
      }).map(task => task.slug),
    ).toEqual(['candidate']);
    expect(
      listBlockedTasks([candidate], DEFAULT_CONFIG, {
        archivedSlugs: ['malformed-archive'],
      }),
    ).toEqual([]);
  });

  it('classifies dangling, self, live, and mixed dependencies as blocked', () => {
    const malformedDependency = task('malformed', {
      created: '2026-01-05T00:00:00.000Z',
    });
    Object.assign(malformedDependency.frontmatter, {
      depends_on: 'live-dependency',
    });
    const tasks = [
      task('done-dependency', { status: 'done' }),
      task('live-dependency', { status: 'in-progress' }),
      task('needs-live', {
        depends_on: ['live-dependency'],
        created: '2026-01-01T00:00:00.000Z',
      }),
      task('dangling', {
        depends_on: ['missing'],
        created: '2026-01-02T00:00:00.000Z',
      }),
      task('self-reference', {
        depends_on: ['self-reference'],
        created: '2026-01-03T00:00:00.000Z',
      }),
      task('mixed', {
        depends_on: ['done-dependency', 'live-dependency'],
        created: '2026-01-04T00:00:00.000Z',
      }),
      malformedDependency,
      task('ready', { created: '2026-01-06T00:00:00.000Z' }),
    ];

    expect(
      listBlockedTasks(tasks, DEFAULT_CONFIG).map(candidate => candidate.slug),
    ).toEqual([
      'needs-live',
      'dangling',
      'self-reference',
      'mixed',
      'malformed',
    ]);

    const actionableSlugs = tasks
      .filter(candidate => candidate.frontmatter.status === 'todo')
      .map(candidate => candidate.slug)
      .sort();
    const classifiedSlugs = [
      ...listAvailableTasks(tasks, DEFAULT_CONFIG),
      ...listBlockedTasks(tasks, DEFAULT_CONFIG),
    ]
      .map(candidate => candidate.slug)
      .sort();
    expect(classifiedSlugs).toEqual(actionableSlugs);
  });

  it('uses an explicit status instead of config.default_column', () => {
    const tasks = [
      task('todo-ready'),
      task('active-ready', { status: 'in-progress' }),
      task('active-blocked', {
        status: 'in-progress',
        depends_on: ['todo-ready'],
      }),
    ];

    expect(
      listAvailableTasks(tasks, DEFAULT_CONFIG, {
        status: 'in-progress',
      }).map(candidate => candidate.slug),
    ).toEqual(['active-ready']);
    expect(
      listBlockedTasks(tasks, DEFAULT_CONFIG, {
        status: 'in-progress',
      }).map(candidate => candidate.slug),
    ).toEqual(['active-blocked']);
  });

  it('sorts priority descending, then creation time ascending, without mutating input', () => {
    const tasks = [
      task('low-oldest', {
        priority: 'low',
        created: '2026-01-01T00:00:00.000Z',
      }),
      task('high-newer', {
        priority: 'high',
        created: '2026-01-05T00:00:00.000Z',
      }),
      task('medium-newer', {
        priority: 'medium',
        created: '2026-01-04T00:00:00.000Z',
      }),
      task('high-older', {
        priority: 'high',
        created: '2026-01-03T00:00:00.000Z',
      }),
      task('default-priority-older', {
        priority: undefined,
        created: '2026-01-02T00:00:00.000Z',
      }),
    ];
    const originalOrder = tasks.map(candidate => candidate.slug);

    expect(
      listAvailableTasks(tasks, DEFAULT_CONFIG).map(
        candidate => candidate.slug,
      ),
    ).toEqual([
      'high-older',
      'high-newer',
      'default-priority-older',
      'medium-newer',
      'low-oldest',
    ]);
    expect(tasks.map(candidate => candidate.slug)).toEqual(originalOrder);
  });
});
