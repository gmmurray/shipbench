/**
 * The render model: everything the renderer needs, and nothing that does I/O.
 *
 * Column identity comes entirely from `config.columns`. The only column this
 * module knows by name is `config.done_column`, and only because core already
 * treats it differently (time-sorted, capped by `done_display.max`, ignores
 * manual layout). No other id appears anywhere.
 */

import {
  createTaskDependencyIndex,
  type ShipbenchConfig,
  type Task,
  type TaskValidationWarning,
  taskDependenciesAreSatisfied,
} from '@shipbench/core';
import { orderedTasksForColumn } from '@shipbench/core/layout';

export interface TuiFilters {
  /** Column ids to render. Empty means every configured column. */
  statuses?: string[];
  tags?: string[];
  assignee?: string;
  priority?: string;
}

export interface ColumnModel {
  id: string;
  label: string;
  /** Tasks after filtering, in core's order. */
  tasks: Task[];
  /** How many tasks the column holds before task filters. */
  total: number;
  /** True for the configured done column. */
  isDone: boolean;
  /** True for the synthetic column holding tasks whose status matches nothing. */
  isUncategorized: boolean;
  /** How many done tasks `done_display.max` hid. */
  cappedOut: number;
}

export interface BoardModel {
  projectName: string;
  columns: ColumnModel[];
  warnings: TaskValidationWarning[];
  /** Live tasks with at least one unresolved or unfinished dependency. */
  blockedTaskSlugs: ReadonlySet<string>;
  /** Tasks whose `status` matched no configured column. */
  uncategorizedCount: number;
  /** `--status` values naming no configured column, in the order given. */
  unknownStatuses: string[];
  /** True when any task filter is active, so counts render as `shown/total`. */
  filtered: boolean;
  /** Set when the last read failed and this model is the previous good state. */
  staleSince?: Date;
  /** Non-fatal problem to surface on the status line. */
  notice?: string;
  updatedAt: Date;
}

/**
 * `orderedTasksForColumn` returns the uncategorized set for *any* id that is not
 * a configured status. Deriving a guaranteed-unique sentinel the same way
 * `cli.ts` does keeps the two consistent and keeps a project free to name a real
 * column `uncategorized`.
 */
export function uncategorizedId(validStatuses: ReadonlySet<string>): string {
  let id = '__uncategorized__';
  while (validStatuses.has(id)) id += '_';
  return id;
}

function matchesFilters(task: Task, filters: TuiFilters): boolean {
  if (filters.assignee && task.frontmatter.assignee !== filters.assignee) {
    return false;
  }
  if (filters.priority && task.frontmatter.priority !== filters.priority) {
    return false;
  }
  const wanted = filters.tags ?? [];
  if (wanted.length > 0) {
    const tags = (task.frontmatter.tags ?? []).map(tag => tag.toLowerCase());
    if (!wanted.every(tag => tags.includes(tag.toLowerCase()))) return false;
  }
  return true;
}

export function hasTaskFilters(filters: TuiFilters): boolean {
  return Boolean(
    filters.assignee ||
      filters.priority ||
      (filters.tags && filters.tags.length > 0),
  );
}

export function buildBoardModel(
  config: ShipbenchConfig,
  tasks: Task[],
  warnings: TaskValidationWarning[],
  filters: TuiFilters = {},
  archivedTasks: readonly Task[] = [],
  archivedSlugs: Iterable<string> = [],
  now: Date = new Date(),
): BoardModel {
  const validStatuses = new Set(config.columns.map(column => column.id));
  const requested = new Set(filters.statuses ?? []);
  const columns: ColumnModel[] = [];
  const dependencyIndex = createTaskDependencyIndex(
    tasks,
    archivedTasks,
    archivedSlugs,
  );
  const blockedTaskSlugs = new Set(
    tasks
      .filter(
        task =>
          !taskDependenciesAreSatisfied(
            task,
            dependencyIndex,
            config.done_column,
          ),
      )
      .map(task => task.slug),
  );

  for (const column of config.columns) {
    if (requested.size > 0 && !requested.has(column.id)) continue;
    const isDone = column.id === config.done_column;
    const ordered = orderedTasksForColumn(
      tasks,
      config.layout,
      column.id,
      validStatuses,
      config.done_column,
    );
    const matching = ordered.filter(task => matchesFilters(task, filters));
    // The done cap is a core display rule, not a TUI invention: `done_display.max`
    // bounds how many finished tasks a board renders by default, most-recent
    // first. `0` or negative disables it.
    //
    // It is applied *after* filtering, not before. Capping first meant
    // `--tag=cli` on this board reported "3/71 … +51 more", where the 51 were
    // simply done tasks beyond the cap — nobody had checked whether any of them
    // matched the tag. Filtering first makes the footer mean what it says: more
    // matches exist than are shown.
    const max = config.done_display?.max ?? 0;
    const capped = isDone && max > 0 ? matching.slice(0, max) : matching;
    columns.push({
      id: column.id,
      label: column.label,
      tasks: capped,
      total: ordered.length,
      isDone,
      isUncategorized: false,
      cappedOut: matching.length - capped.length,
    });
  }

  const uncategorized = orderedTasksForColumn(
    tasks,
    config.layout,
    uncategorizedId(validStatuses),
    validStatuses,
    config.done_column,
  );

  // Never dropped, and never gated behind `--status`: a task in no column is a
  // read-time defect the operator has to see, not a column they chose to hide.
  if (uncategorized.length > 0) {
    columns.push({
      id: uncategorizedId(validStatuses),
      label: 'Uncategorized',
      tasks: uncategorized.filter(task => matchesFilters(task, filters)),
      total: uncategorized.length,
      isDone: false,
      isUncategorized: true,
      cappedOut: 0,
    });
  }

  return {
    projectName: config.name,
    columns,
    warnings,
    blockedTaskSlugs,
    uncategorizedCount: uncategorized.length,
    // A `--status` value that names no column selects nothing, silently. Naming
    // the ones that missed is what lets the renderer say so instead of leaving
    // the operator with an inexplicably narrow board.
    unknownStatuses: (filters.statuses ?? []).filter(
      status => !validStatuses.has(status),
    ),
    filtered: hasTaskFilters(filters),
    updatedAt: now,
  };
}

/** 0-based rank within `config.priority.values`; -1 when unknown or unset. */
export function priorityRank(task: Task, config: ShipbenchConfig): number {
  const value = task.frontmatter.priority ?? config.priority.default;
  return config.priority.values.indexOf(value);
}
