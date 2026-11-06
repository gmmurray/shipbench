import type { ShipbenchConfig, Task } from './types.js';

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

  return dependencies.every(
    dependency =>
      dependency !== task.slug &&
      dependencyIsSatisfied(dependency, index, doneColumn),
  );
}

/** Whether `slug` counts as finished for any task that depends on it. */
function dependencyIsSatisfied(
  slug: string,
  index: TaskDependencyIndex,
  doneColumn: string,
): boolean {
  const resolution = resolveTaskDependency(slug, index);
  return (
    resolution.kind === 'archived' ||
    (resolution.kind === 'live' && resolution.status === doneColumn)
  );
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

export type TaskDependencyDirection = 'blockers' | 'dependents';

export interface TaskDependencyQueryOptions extends TaskDependencyGraphOptions {
  /** Which side of the task to walk. Defaults to both. */
  direction?: TaskDependencyDirection | 'both';
  /**
   * How many levels to walk; `1` lists direct neighbors only. Omit for no
   * limit. Supplied `archivedTasks` are walked through like live tasks, as
   * they become nodes in `buildTaskDependencyGraph`.
   */
  depth?: number;
  /** Slugs of live task files whose frontmatter did not parse. */
  unreadableSlugs?: Iterable<string>;
}

export interface TaskDependencyQueryNode {
  slug: string;
  /** A column id, `archived`, `missing`, or `unreadable`. */
  status: string;
  title?: string;
  /** Blockers only: whether this node counts as finished for its dependent. */
  satisfied?: boolean;
  /** Set when `depends_on` is not a list of slugs. Readiness treats it as unmet. */
  invalid_depends_on?: true;
  /**
   * Direct dependents only: whether finishing the queried task would make this
   * one available, by the same rules as `listAvailableTasks`. Always false
   * when the queried task already counts as finished.
   */
  unblocks_on_completion?: boolean;
  /** Direct dependents only: its other unsatisfied dependencies. */
  waiting_on?: string[];
  children: TaskDependencyQueryNode[];
  /**
   * Present when this node has neighbors that `children` does not list:
   * `repeat` (expanded where it first appears), `cycle` (it is its own
   * ancestor here), or `depth` (beyond the requested depth).
   */
  omitted?: 'repeat' | 'cycle' | 'depth';
}

export interface TaskDependencyQuery {
  slug: string;
  status: string;
  title: string;
  /** Every dependency is in the done column or archived. */
  dependencies_satisfied: boolean;
  /** Live, in the default column, and `dependencies_satisfied`: what `--available` lists. */
  available: boolean;
  invalid_depends_on?: true;
  depth: number | null;
  /** True when any branch stopped at `depth`, so the result is incomplete. */
  truncated: boolean;
  blockers?: TaskDependencyQueryNode[];
  dependents?: TaskDependencyQueryNode[];
}

/**
 * Walks the dependency chain on either side of one task. Each slug is expanded
 * once per side, at its shallowest occurrence, so a branching graph stays
 * bounded and a cycle cannot loop. Returns `null` when `slug` is neither a
 * live task nor a supplied archived task.
 */
export function queryTaskDependencies(
  slug: string,
  liveTasks: readonly Task[],
  config: Pick<ShipbenchConfig, 'done_column' | 'default_column'>,
  options: TaskDependencyQueryOptions = {},
): TaskDependencyQuery | null {
  const archivedTasks = options.archivedTasks ?? [];
  const index = createTaskDependencyIndex(
    liveTasks,
    archivedTasks,
    options.archivedSlugs,
  );
  const unreadable = new Set(options.unreadableSlugs);
  const sourceTasks = new Map<string, Task>([
    ...archivedTasks.map(task => [task.slug, task] as const),
    ...liveTasks.map(task => [task.slug, task] as const),
  ]);
  const root = sourceTasks.get(slug);
  if (!root) return null;

  const dependentsOf = new Map<string, string[]>();
  for (const task of sourceTasks.values()) {
    for (const dependency of dependencySlugs(task) ?? []) {
      const list = dependentsOf.get(dependency) ?? [];
      list.push(task.slug);
      dependentsOf.set(dependency, list);
    }
  }
  const neighbors = (direction: TaskDependencyDirection, of: string) => {
    const task = sourceTasks.get(of);
    const found =
      direction === 'blockers'
        ? task
          ? (dependencySlugs(task) ?? [])
          : []
        : (dependentsOf.get(of) ?? []);
    return [...new Set(found)].sort((a, b) => a.localeCompare(b));
  };
  const statusOf = (of: string) => {
    const resolution = resolveTaskDependency(of, index);
    if (resolution.kind === 'missing' && unreadable.has(of)) {
      return 'unreadable';
    }
    return resolution.status;
  };
  const satisfied = (of: string) =>
    dependencyIsSatisfied(of, index, config.done_column);
  const rootSatisfied = satisfied(slug);
  const maxDepth = options.depth ?? Number.POSITIVE_INFINITY;
  let truncated = false;

  const walk = (direction: TaskDependencyDirection) => {
    // Shallowest level per slug, so a node reachable along a short and a long
    // path is expanded where the depth limit is least likely to cut it off.
    const shallowest = new Map<string, number>([[slug, 0]]);
    let frontier = [slug];
    for (let level = 1; frontier.length > 0 && level <= maxDepth; level++) {
      const next: string[] = [];
      for (const current of frontier) {
        for (const neighbor of neighbors(direction, current)) {
          if (shallowest.has(neighbor)) continue;
          shallowest.set(neighbor, level);
          next.push(neighbor);
        }
      }
      frontier = next;
    }

    const expanded = new Set<string>();
    const build = (
      current: string,
      level: number,
      path: ReadonlySet<string>,
      parent: string,
    ): TaskDependencyQueryNode => {
      const task = sourceTasks.get(current);
      const dependencies = task ? dependencySlugs(task) : [];
      const node: Omit<TaskDependencyQueryNode, 'children'> = {
        slug: current,
        status: statusOf(current),
        ...(task ? { title: task.frontmatter.title } : {}),
      };
      let children: TaskDependencyQueryNode[] = [];
      if (direction === 'blockers') node.satisfied = satisfied(current);
      if (dependencies === null) node.invalid_depends_on = true;
      if (direction === 'dependents' && level === 1) {
        const waiting = (dependencies ?? []).filter(
          dependency =>
            // A self-reference never resolves, even when it is the parent.
            dependency === current ||
            (dependency !== parent && !satisfied(dependency)),
        );
        node.unblocks_on_completion =
          index.liveTasksBySlug.has(current) &&
          task?.frontmatter.status === config.default_column &&
          dependencies !== null &&
          !rootSatisfied &&
          waiting.length === 0;
        node.waiting_on = waiting;
      }

      const next = neighbors(direction, current);
      if (next.length === 0) return { ...node, children };
      if (path.has(current)) {
        node.omitted = 'cycle';
      } else if (expanded.has(current) || shallowest.get(current) !== level) {
        node.omitted = 'repeat';
      } else if (level >= maxDepth) {
        node.omitted = 'depth';
        truncated = true;
      } else {
        expanded.add(current);
        const childPath = new Set(path).add(current);
        children = next.map(child =>
          build(child, level + 1, childPath, current),
        );
      }
      return { ...node, children };
    };

    const rootPath = new Set([slug]);
    return neighbors(direction, slug).map(child =>
      build(child, 1, rootPath, slug),
    );
  };

  const direction = options.direction ?? 'both';
  const dependenciesSatisfied = taskDependenciesAreSatisfied(
    root,
    index,
    config.done_column,
  );
  const result: TaskDependencyQuery = {
    slug,
    status: statusOf(slug),
    title: root.frontmatter.title,
    dependencies_satisfied: dependenciesSatisfied,
    available:
      index.liveTasksBySlug.has(slug) &&
      root.frontmatter.status === config.default_column &&
      dependenciesSatisfied,
    ...(dependencySlugs(root) === null
      ? { invalid_depends_on: true as const }
      : {}),
    depth: options.depth ?? null,
    truncated: false,
  };
  if (direction !== 'dependents') result.blockers = walk('blockers');
  if (direction !== 'blockers') result.dependents = walk('dependents');
  result.truncated = truncated;
  return result;
}
