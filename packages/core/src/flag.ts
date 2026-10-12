import type { Task } from './types.js';

/** A task's flag as hosts display it. */
export interface TaskFlag {
  /** The reason the flag gives, or `null` for a bare `flag: true`. */
  reason: string | null;
}

/**
 * Reads a task's flag, or `null` when the task is not flagged.
 *
 * Only `true` and a non-blank string flag a task. Anything else a hand edit
 * leaves behind (`false`, an empty value, a list) reads as unflagged; the
 * directory read reports it as a validation warning rather than guessing.
 *
 * Pure and import-free so the Board can call it from the `@shipbench/core/flag`
 * subpath: a card, a column count, and `task list --flagged` must all agree on
 * which tasks are flagged.
 */
export function taskFlag(task: Pick<Task, 'frontmatter'>): TaskFlag | null {
  const { flag } = task.frontmatter as { flag?: unknown };
  if (flag === true) return { reason: null };
  if (typeof flag === 'string' && flag.trim()) return { reason: flag.trim() };
  return null;
}

/** Whether {@link taskFlag} finds a flag on the task. */
export function isTaskFlagged(task: Pick<Task, 'frontmatter'>): boolean {
  return taskFlag(task) !== null;
}
