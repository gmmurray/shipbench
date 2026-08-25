import { describe, expect, it } from 'vitest';
import {
  buildTaskDependencyGraph,
  createTaskDependencyIndex,
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
