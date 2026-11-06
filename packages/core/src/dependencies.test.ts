import { describe, expect, it } from 'vitest';
import {
  buildTaskDependencyGraph,
  createTaskDependencyIndex,
  queryTaskDependencies,
  resolveTaskDependency,
  taskDependenciesAreSatisfied,
} from './dependencies.js';
import type { Task, TaskFrontmatter } from './types.js';

function task(slug: string, fields: Partial<TaskFrontmatter> = {}): Task {
  return {
    slug,
    frontmatter: {
      title: slug,
      status: 'todo',
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-01T00:00:00.000Z',
      ...fields,
    },
    body: '',
    comments: [],
  };
}

describe('task dependency resolution', () => {
  it('builds forward and reverse edges with status annotations', () => {
    const graph = buildTaskDependencyGraph([
      task('foundation', { status: 'done' }),
      task('api', {
        status: 'in-progress',
        depends_on: ['foundation'],
      }),
      task('standalone'),
    ]);

    expect(graph).toEqual({
      api: {
        status: 'in-progress',
        depends_on: ['foundation'],
        blocks: [],
      },
      foundation: {
        status: 'done',
        depends_on: [],
        blocks: ['api'],
      },
      standalone: {
        status: 'todo',
        depends_on: [],
        blocks: [],
      },
    });
  });

  it('surfaces dangling dependencies as missing nodes', () => {
    const graph = buildTaskDependencyGraph([
      task('consumer', { depends_on: ['not-on-board'] }),
    ]);

    expect(graph['not-on-board']).toEqual({
      status: 'missing',
      depends_on: [],
      blocks: ['consumer'],
    });
  });

  it('marks supplied archived tasks and uses the same status resolution for availability', () => {
    const liveTasks = [
      task('consumer', { depends_on: ['archived-foundation'] }),
    ];
    const archivedTasks = [
      task('archived-foundation', {
        status: 'in-progress',
      }),
    ];
    const graph = buildTaskDependencyGraph(liveTasks, { archivedTasks });
    const index = createTaskDependencyIndex(liveTasks, archivedTasks);

    expect(graph['archived-foundation']).toEqual({
      status: 'archived',
      depends_on: [],
      blocks: ['consumer'],
    });
    expect(taskDependenciesAreSatisfied(liveTasks[0]!, index, 'done')).toBe(
      true,
    );
  });

  it('treats an archive file slug as archived when its task did not parse', () => {
    const consumer = task('consumer', {
      depends_on: ['malformed-foundation'],
    });
    const index = createTaskDependencyIndex(
      [consumer],
      [],
      ['malformed-foundation'],
    );

    expect(resolveTaskDependency('malformed-foundation', index)).toEqual({
      kind: 'archived',
      status: 'archived',
    });
    expect(taskDependenciesAreSatisfied(consumer, index, 'done')).toBe(true);
  });

  it('marks a synthesized dependency node archived from its file slug', () => {
    const graph = buildTaskDependencyGraph(
      [task('consumer', { depends_on: ['malformed-foundation'] })],
      { archivedSlugs: ['malformed-foundation'] },
    );

    expect(graph['malformed-foundation']).toEqual({
      status: 'archived',
      depends_on: [],
      blocks: ['consumer'],
    });
  });
});

describe('queryTaskDependencies', () => {
  const config = { done_column: 'done', default_column: 'todo' };

  // shared <- schema <- api <- ui
  //        <- auth   <-/     <- docs (also depends on schema)
  function branching(): Task[] {
    return [
      task('shared', { status: 'in-progress' }),
      task('schema', { status: 'done', depends_on: ['shared'] }),
      task('auth', { depends_on: ['shared'] }),
      task('api', { depends_on: ['schema', 'auth'] }),
      task('ui', { depends_on: ['api'] }),
      task('docs', { depends_on: ['api', 'schema'] }),
    ];
  }

  it('walks the blocking chain, expanding a shared prerequisite once', () => {
    const query = queryTaskDependencies('api', branching(), config, {
      direction: 'blockers',
    });

    expect(query).toMatchObject({
      slug: 'api',
      status: 'todo',
      dependencies_satisfied: false,
      available: false,
      depth: null,
      truncated: false,
    });
    expect(query?.dependents).toBeUndefined();
    expect(query?.blockers).toEqual([
      {
        slug: 'auth',
        status: 'todo',
        title: 'auth',
        satisfied: false,
        children: [
          {
            slug: 'shared',
            status: 'in-progress',
            title: 'shared',
            satisfied: false,
            children: [],
          },
        ],
      },
      {
        slug: 'schema',
        status: 'done',
        title: 'schema',
        satisfied: true,
        children: [
          {
            slug: 'shared',
            status: 'in-progress',
            title: 'shared',
            satisfied: false,
            children: [],
          },
        ],
      },
    ]);
  });

  it('tells a dependent that would become available from one that would not', () => {
    const query = queryTaskDependencies('api', branching(), config, {
      direction: 'dependents',
    });

    expect(query?.dependents).toEqual([
      {
        slug: 'docs',
        status: 'todo',
        title: 'docs',
        unblocks_on_completion: true,
        waiting_on: [],
        children: [],
      },
      {
        slug: 'ui',
        status: 'todo',
        title: 'ui',
        unblocks_on_completion: true,
        waiting_on: [],
        children: [],
      },
    ]);

    const shared = queryTaskDependencies('shared', branching(), config, {
      direction: 'dependents',
    });
    const [auth, schema] = shared?.dependents ?? [];
    expect(auth).toMatchObject({ slug: 'auth', unblocks_on_completion: true });
    // Already done, so finishing `shared` does not make it available.
    expect(schema).toMatchObject({
      slug: 'schema',
      unblocks_on_completion: false,
      waiting_on: [],
    });
    // `api` is reached through both; it is expanded under the first only.
    expect(auth?.children.map(child => child.slug)).toEqual(['api']);
    expect(schema?.children).toEqual([
      expect.objectContaining({ slug: 'api', omitted: 'repeat', children: [] }),
      expect.objectContaining({ slug: 'docs', children: [] }),
    ]);
  });

  it('names the other blockers a direct dependent still waits on', () => {
    const tasks = [
      task('first'),
      task('second'),
      task('consumer', { depends_on: ['first', 'second', 'gone'] }),
    ];
    const query = queryTaskDependencies('first', tasks, config, {
      direction: 'dependents',
    });

    expect(query?.dependents?.[0]).toMatchObject({
      slug: 'consumer',
      unblocks_on_completion: false,
      waiting_on: ['second', 'gone'],
    });
  });

  it('uses the configured columns for readiness', () => {
    const tasks = [
      task('base', { status: 'shipped' }),
      task('next', { status: 'ready', depends_on: ['base'] }),
    ];
    const query = queryTaskDependencies(
      'next',
      tasks,
      { done_column: 'shipped', default_column: 'ready' },
      { direction: 'blockers' },
    );

    expect(query).toMatchObject({
      dependencies_satisfied: true,
      available: true,
    });
    expect(query?.blockers?.[0]?.satisfied).toBe(true);
  });

  it('reports a node cut off by depth and marks the result truncated', () => {
    const query = queryTaskDependencies('ui', branching(), config, {
      direction: 'blockers',
      depth: 1,
    });

    expect(query?.truncated).toBe(true);
    expect(query?.depth).toBe(1);
    expect(query?.blockers).toEqual([
      expect.objectContaining({ slug: 'api', omitted: 'depth', children: [] }),
    ]);
  });

  it('expands a node at its shallowest occurrence so depth cuts the least', () => {
    // `deep` sits at level 1 via `top` and at level 2 via `middle`.
    const tasks = [
      task('deep', { depends_on: ['leaf'] }),
      task('leaf'),
      task('middle', { depends_on: ['deep'] }),
      task('top', { depends_on: ['middle', 'deep'] }),
    ];
    const query = queryTaskDependencies('top', tasks, config, {
      direction: 'blockers',
      depth: 2,
    });

    expect(query?.truncated).toBe(false);
    expect(query?.blockers?.[0]).toMatchObject({
      slug: 'deep',
      children: [expect.objectContaining({ slug: 'leaf' })],
    });
    expect(query?.blockers?.[1]?.children[0]).toMatchObject({
      slug: 'deep',
      omitted: 'repeat',
    });
  });

  it('stops at a cycle instead of looping', () => {
    const tasks = [
      task('a', { depends_on: ['b'] }),
      task('b', { depends_on: ['c'] }),
      task('c', { depends_on: ['a'] }),
      task('self', { depends_on: ['self'] }),
    ];
    const query = queryTaskDependencies('a', tasks, config);

    expect(query?.blockers?.[0]?.children[0]?.children[0]).toMatchObject({
      slug: 'a',
      omitted: 'cycle',
      children: [],
    });
    expect(query?.dependents?.[0]?.slug).toBe('c');

    const self = queryTaskDependencies('self', tasks, config);
    expect(self?.dependencies_satisfied).toBe(false);
    expect(self?.blockers).toEqual([
      expect.objectContaining({ slug: 'self', omitted: 'cycle' }),
    ]);
    expect(self?.dependents?.[0]).toMatchObject({
      unblocks_on_completion: false,
      waiting_on: ['self'],
    });
  });

  it('shows missing, unreadable, and malformed relationships', () => {
    const tasks = [
      task('consumer', { depends_on: ['gone', 'broken'] }),
      task('odd', { depends_on: 'consumer' as unknown as string[] }),
    ];
    const query = queryTaskDependencies('consumer', tasks, config, {
      unreadableSlugs: ['broken'],
    });

    expect(query?.blockers).toEqual([
      { slug: 'broken', status: 'unreadable', satisfied: false, children: [] },
      { slug: 'gone', status: 'missing', satisfied: false, children: [] },
    ]);
    // A malformed list draws no edges, as in the full graph.
    expect(query?.dependents).toEqual([]);

    expect(queryTaskDependencies('odd', tasks, config)).toMatchObject({
      invalid_depends_on: true,
      dependencies_satisfied: false,
      blockers: [],
    });
  });

  it('counts an archived prerequisite as satisfied and walks it only when supplied', () => {
    const liveTasks = [task('consumer', { depends_on: ['old'] })];
    const archivedTasks = [
      task('old', { status: 'in-progress', depends_on: ['older'] }),
      task('older', { status: 'done' }),
    ];

    const bySlug = queryTaskDependencies('consumer', liveTasks, config, {
      archivedSlugs: ['old', 'older'],
    });
    expect(bySlug).toMatchObject({ available: true });
    expect(bySlug?.blockers).toEqual([
      { slug: 'old', status: 'archived', satisfied: true, children: [] },
    ]);

    const walked = queryTaskDependencies('consumer', liveTasks, config, {
      archivedTasks,
    });
    expect(walked?.blockers?.[0]?.children).toEqual([
      expect.objectContaining({ slug: 'older', status: 'archived' }),
    ]);

    expect(queryTaskDependencies('old', liveTasks, config)).toBeNull();
    const archivedRoot = queryTaskDependencies('old', liveTasks, config, {
      archivedTasks,
    });
    expect(archivedRoot).toMatchObject({
      status: 'archived',
      available: false,
    });
    expect(archivedRoot?.dependents?.[0]).toMatchObject({
      slug: 'consumer',
      unblocks_on_completion: false,
    });
  });

  it('returns null for an unknown slug', () => {
    expect(queryTaskDependencies('nope', branching(), config)).toBeNull();
  });
});
