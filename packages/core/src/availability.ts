import {
  createTaskDependencyIndex,
  taskDependenciesAreSatisfied,
} from './dependencies.js';
import type { ShipbenchConfig, Task } from './types.js';

export interface TaskAvailabilityOptions {
  /** Column whose tasks are candidates. Defaults to `config.default_column`. */
  status?: string;
  /** Already-read tasks from `.shipbench/tasks/archive/`. */
  archivedTasks?: readonly Task[];
  /** Archive file slugs, including files whose contents did not parse. */
  archivedSlugs?: Iterable<string>;
}

/**
 * Ranking for `--available`/`--blocked`: priority desc, then oldest `created`,
 * then slug. Computed from frontmatter alone — it never reads `layout.json`,
 * so it is independent of manual board position by construction.
 *
 * The two orderings can therefore disagree, and that is expected rather than a
 * defect. This one answers "which of these is dependency-ready, and which is
 * highest priority among them." Board position answers "where in the column
 * did someone put it." Callers that want the latter still have it: these
 * results carry each task's `position`, computed before this sort, so reading
 * board placement never requires trusting that this ranking preserved it.
 * Core does not treat either as the authoritative answer.
 *
 * Note the `created` tiebreak runs opposite the board's own fallback for
 * unpositioned tasks (`byCreatedDesc` in `layout.ts`, newest first). Rendering
 * a board defaults to recency; this defaults to oldest-first, so a long-lived
 * task does not sink behind newer ones at the same priority.
 */
function compareTaskReadiness(
  a: Task,
  b: Task,
  config: ShipbenchConfig,
): number {
  const priorityRank = (task: Task): number => {
    const priority = task.frontmatter.priority ?? config.priority.default;
    return config.priority.values.indexOf(priority);
  };
  const priorityDifference = priorityRank(b) - priorityRank(a);
  if (priorityDifference !== 0) return priorityDifference;

  const aCreated = Date.parse(a.frontmatter.created);
  const bCreated = Date.parse(b.frontmatter.created);
  if (Number.isFinite(aCreated) && Number.isFinite(bCreated)) {
    const createdDifference = aCreated - bCreated;
    if (createdDifference !== 0) return createdDifference;
  } else if (Number.isFinite(aCreated)) {
    return -1;
  } else if (Number.isFinite(bCreated)) {
    return 1;
  }

  return a.slug.localeCompare(b.slug);
}

function listTasksByAvailability(
  tasks: readonly Task[],
  config: ShipbenchConfig,
  mode: 'available' | 'blocked',
  options: TaskAvailabilityOptions = {},
): Task[] {
  const status = options.status ?? config.default_column;
  const dependencyIndex = createTaskDependencyIndex(
    tasks,
    options.archivedTasks,
    options.archivedSlugs,
  );

  return tasks
    .filter(task => {
      if (task.frontmatter.status !== status) return false;
      const available = taskDependenciesAreSatisfied(
        task,
        dependencyIndex,
        config.done_column,
      );
      return mode === 'available' ? available : !available;
    })
    .sort((a, b) => compareTaskReadiness(a, b, config));
}

/**
 * Returns tasks in the actionable column whose dependencies are all complete.
 * This function is pure and performs no adapter reads.
 */
export function listAvailableTasks(
  tasks: readonly Task[],
  config: ShipbenchConfig,
  options: TaskAvailabilityOptions = {},
): Task[] {
  return listTasksByAvailability(tasks, config, 'available', options);
}

/**
 * Returns tasks in the actionable column with at least one unsatisfied
 * dependency. This function is pure and performs no adapter reads.
 */
export function listBlockedTasks(
  tasks: readonly Task[],
  config: ShipbenchConfig,
  options: TaskAvailabilityOptions = {},
): Task[] {
  return listTasksByAvailability(tasks, config, 'blocked', options);
}
