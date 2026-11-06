import type { Task } from './types.js';

/**
 * Which file records an association, seen from the task being read.
 *
 * - `outgoing`: this task's own `related` names the other one.
 * - `incoming`: only the other task's `related` names this one.
 * - `both`: each file names the other.
 *
 * Only an `outgoing` or `both` entry can be removed by editing this task; an
 * `incoming` one lives in the other task's file.
 */
export type RelatedDirection = 'outgoing' | 'incoming' | 'both';

/** One associated task, resolved far enough to be read without a lookup. */
export interface RelatedTask {
  slug: string;
  direction: RelatedDirection;
  /** The target's title, or `null` when its file is not loaded or not found. */
  title: string | null;
  /** The target's status, or `null` on the same terms as `title`. */
  status: string | null;
  /**
   * Whether the target lives in `tasks/archive/`. An archived target whose file
   * was not loaded is still `true`, with a `null` title and status. A target
   * that is neither live nor archived is unresolved: `false`, with both `null`.
   */
  archived: boolean;
}

export interface RelatedIndexInput {
  /** Live tasks. Their `related` values supply the incoming edges. */
  tasks: readonly Task[];
  /** Archived tasks, when they are loaded. */
  archivedTasks?: readonly Task[];
  /** Archive file slugs, including files that were not loaded or did not parse. */
  archivedSlugs?: Iterable<string>;
}

/**
 * A task's `related` slugs as written, skipping anything that is not a slug.
 *
 * A hand edit can leave a bare string or a list of numbers behind; the
 * directory read reports that as a warning, and this reads it as nothing rather
 * than guessing.
 */
export function relatedSlugs(task: Pick<Task, 'frontmatter'>): string[] {
  const { related } = task.frontmatter as { related?: unknown };
  if (!Array.isArray(related)) return [];
  const slugs = related
    .filter((slug): slug is string => typeof slug === 'string')
    .map(slug => slug.trim())
    .filter(Boolean);
  return [...new Set(slugs)];
}

/**
 * Resolves associations in both directions across the tasks a read holds.
 *
 * A file stores one direction, so the other is only visible to a read that
 * holds both tasks. Build the index once over the read and ask it per task: an
 * association written on either side, or both, comes back once.
 *
 * Pure and import-free so the Board can call it from the
 * `@shipbench/core/related` subpath, and agree with `task list --json`.
 */
export function createRelatedIndex(
  input: RelatedIndexInput,
): (task: Task) => RelatedTask[] {
  const archivedTasks = input.archivedTasks ?? [];
  const liveBySlug = new Map(input.tasks.map(task => [task.slug, task]));
  const archivedBySlug = new Map(archivedTasks.map(task => [task.slug, task]));
  const archivedSlugs = new Set([
    ...(input.archivedSlugs ?? []),
    ...archivedBySlug.keys(),
  ]);

  const incoming = new Map<string, string[]>();
  for (const source of [...input.tasks, ...archivedTasks]) {
    for (const target of relatedSlugs(source)) {
      if (target === source.slug) continue;
      const sources = incoming.get(target) ?? [];
      if (!sources.includes(source.slug)) sources.push(source.slug);
      incoming.set(target, sources);
    }
  }

  const resolve = (slug: string, direction: RelatedDirection): RelatedTask => {
    const live = liveBySlug.get(slug);
    const archived = live ? undefined : archivedBySlug.get(slug);
    const found = live ?? archived;
    return {
      slug,
      direction,
      title: found?.frontmatter.title ?? null,
      status: found?.frontmatter.status ?? null,
      archived: !live && archivedSlugs.has(slug),
    };
  };

  return task => {
    const outgoing = relatedSlugs(task).filter(slug => slug !== task.slug);
    const fromOthers = incoming.get(task.slug) ?? [];
    const own = new Set(outgoing);
    return [
      ...outgoing.map(slug =>
        resolve(slug, fromOthers.includes(slug) ? 'both' : 'outgoing'),
      ),
      ...fromOthers
        .filter(slug => !own.has(slug))
        .map(slug => resolve(slug, 'incoming')),
    ];
  };
}
