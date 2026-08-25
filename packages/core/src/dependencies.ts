import type { Task } from './types.js';

export interface TaskDependencyGraphNode {
  status: string;
  depends_on: string[];
  blocks: string[];
}

export type TaskDependencyGraph = Record<string, TaskDependencyGraphNode>;

export interface TaskDependencyGraphOptions {
  /** Already-read tasks from `.shipbench/tasks/archive/`. */
  archivedTasks?: readonly Task[];
  /** Archive file slugs, including files whose contents did not parse. */
  archivedSlugs?: Iterable<string>;
}

export interface TaskDependencyIndex {
  liveTasksBySlug: ReadonlyMap<string, Task>;
  archivedTasksBySlug: ReadonlyMap<string, Task>;
  /** Archive file identities, including files whose contents did not parse. */
  archivedSlugs: ReadonlySet<string>;
}

export type TaskDependencyResolution =
  | { kind: 'live'; status: string; task: Task }
  | { kind: 'archived'; status: 'archived'; task?: Task }
  | { kind: 'missing'; status: 'missing' };

export function createTaskDependencyIndex(
  liveTasks: readonly Task[],
  archivedTasks: readonly Task[] = [],
  archivedSlugs: Iterable<string> = [],
): TaskDependencyIndex {
  return {
    liveTasksBySlug: new Map(liveTasks.map(task => [task.slug, task])),
    archivedTasksBySlug: new Map(archivedTasks.map(task => [task.slug, task])),
    archivedSlugs: new Set([
      ...archivedSlugs,
      ...archivedTasks.map(task => task.slug),
    ]),
  };
}

function dependencySlugs(task: Task): string[] | null {
  const dependencies = task.frontmatter.depends_on;
  if (dependencies === undefined) return [];
  if (!Array.isArray(dependencies)) return null;
  if (dependencies.some(dependency => typeof dependency !== 'string')) {
    return null;
  }
  return [...new Set(dependencies)];
}

export function resolveTaskDependency(
  slug: string,
  index: TaskDependencyIndex,
): TaskDependencyResolution {
  const liveTask = index.liveTasksBySlug.get(slug);
  if (liveTask) {
    return {
      kind: 'live',
      status: liveTask.frontmatter.status,
      task: liveTask,
    };
  }
  const archivedTask = index.archivedTasksBySlug.get(slug);
  if (archivedTask) {
    return { kind: 'archived', status: 'archived', task: archivedTask };
  }
  // Archive membership is a file-level fact. A malformed archived file cannot
  // produce a Task, but its slug still satisfies a dependency; the read warning
  // reports the malformed contents separately.
  if (index.archivedSlugs.has(slug)) {
    return { kind: 'archived', status: 'archived' };
  }
  return { kind: 'missing', status: 'missing' };
}

export function dependencyStatus(
  slug: string,
  index: TaskDependencyIndex,
): string {
  return resolveTaskDependency(slug, index).status;
}

export function taskDependenciesAreSatisfied(
  task: Task,
  index: TaskDependencyIndex,
  doneColumn: string,
): boolean {
  const dependencies = dependencySlugs(task);
  if (dependencies === null) return false;

  return dependencies.every(dependency => {
    if (dependency === task.slug) return false;
    const resolution = resolveTaskDependency(dependency, index);
    return (
      resolution.kind === 'archived' ||
      (resolution.kind === 'live' && resolution.status === doneColumn)
    );
  });
}

/**
 * Builds forward and reverse dependency adjacency for live tasks plus any
 * supplied archived tasks. Referenced slugs outside that set are represented
 * as missing nodes so callers never need a second lookup.
 */
export function buildTaskDependencyGraph(
  liveTasks: readonly Task[],
  options: TaskDependencyGraphOptions = {},
): TaskDependencyGraph {
  const archivedTasks = options.archivedTasks ?? [];
  const index = createTaskDependencyIndex(
    liveTasks,
    archivedTasks,
    options.archivedSlugs,
  );
  const nodes = new Map<string, TaskDependencyGraphNode>();
  const sourceTasks = [
    ...liveTasks,
    ...archivedTasks.filter(task => !index.liveTasksBySlug.has(task.slug)),
  ];

  for (const task of sourceTasks) {
    nodes.set(task.slug, {
      status: dependencyStatus(task.slug, index),
      depends_on: dependencySlugs(task) ?? [],
      blocks: [],
    });
  }

  for (const task of sourceTasks) {
    const dependencies = dependencySlugs(task) ?? [];
    for (const dependency of dependencies) {
      const dependencyNode = nodes.get(dependency) ?? {
        status: dependencyStatus(dependency, index),
        depends_on: [],
        blocks: [],
      };
      dependencyNode.blocks.push(task.slug);
      nodes.set(dependency, dependencyNode);
    }
  }

  return Object.fromEntries(
    [...nodes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([slug, node]) => [
        slug,
        {
          ...node,
          blocks: [...new Set(node.blocks)].sort((a, b) => a.localeCompare(b)),
        },
      ]),
  );
}
