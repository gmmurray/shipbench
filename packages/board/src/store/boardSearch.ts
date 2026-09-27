import type { Task, TaskSearchMatch } from '@shipbench/core';
// The value comes from the pure `search` subpath, never the barrel: the barrel
// re-exports FsAdapter, which imports `node:fs` and cannot be bundled for the
// browser. See AGENTS.md on the core/board boundary.
import { searchTasks } from '@shipbench/core/search';

/**
 * The identifiers a surface prints next to a task's title. They join the
 * search corpus, and a term found in one of them (or the title) needs no
 * further explanation because the reader can already see it.
 */
export type CardFace = (task: Task) => string[];

/** What a board card shows beside its title: slug, assignee, and tags. */
export const boardCardFace: CardFace = task => [
  task.slug,
  ...(task.frontmatter.assignee ? [task.frontmatter.assignee] : []),
  ...(task.frontmatter.tags ?? []),
];

export interface BoardSearchResult {
  /** Matching tasks in the order they were passed in, not relevance order. */
  tasks: Task[];
  /**
   * Matches the card cannot explain on its own: at least one query term occurs
   * only in the description or a Task Update. Each carries core's `snippet`
   * and `update_matches` so the card can show where the term was found.
   */
  contextBySlug: ReadonlyMap<string, TaskSearchMatch>;
}

const NO_CONTEXT: ReadonlyMap<string, TaskSearchMatch> = new Map();

/**
 * Filters tasks with core's `searchTasks`, so a query means the same thing on
 * the board as in `shipbench task search`: the same term and phrase grammar,
 * over title, tags, description, and every Task Updates entry.
 *
 * The board adds the identifiers its cards print (`cardFace`) to that corpus.
 * Board search matched slugs and assignees before it matched descriptions,
 * and those lookups keep working. They are folded in as extra tags, so each
 * term still only has to occur somewhere, and a term can land in any field.
 *
 * Results keep the caller's order. A kanban column's order is its layout, so
 * core's relevance ranking has nothing to reorder.
 */
export function searchBoardTasks(
  tasks: readonly Task[],
  query: string,
  cardFace: CardFace = boardCardFace,
): BoardSearchResult {
  if (!query.trim()) return { tasks: [...tasks], contextBySlug: NO_CONTEXT };

  const matches = new Map(
    searchTasks(
      tasks.map(task => ({
        ...task,
        frontmatter: {
          ...task.frontmatter,
          tags: [...(task.frontmatter.tags ?? []), ...cardFace(task)],
        },
      })),
      query,
    ).map(match => [match.slug, match]),
  );

  const matched = tasks.filter(task => matches.has(task.slug));
  // The same query against only what the card shows. A task that still
  // matches needs no content context.
  const faceOnly = new Set(
    searchTasks(
      matched.map(task => ({
        slug: task.slug,
        frontmatter: { ...task.frontmatter, tags: cardFace(task) },
        body: '',
        comments: [],
      })),
      query,
    ).map(match => match.slug),
  );

  const contextBySlug = new Map<string, TaskSearchMatch>();
  for (const task of matched) {
    const match = matches.get(task.slug);
    if (match && !faceOnly.has(task.slug)) contextBySlug.set(task.slug, match);
  }

  return { tasks: matched, contextBySlug };
}
