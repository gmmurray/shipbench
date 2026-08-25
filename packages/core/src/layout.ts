import type { BoardLayout, Task } from './types.js';

/**
 * Pure layout algebra — the single definition of manual task ordering.
 *
 * `layout.json` is machine-managed, and for a while two implementations of these
 * rules existed: core's (authoritative, applied on write) and the Board store's
 * optimistic copy, kept in sync by hand and by comment. They had already begun
 * to diverge. Both now call these functions, so there is no mirror left to
 * drift — see docs/audits/board-move-algorithm-audit.md.
 *
 * Nothing here does I/O. Callers supply the current layout and the task list.
 */

/**
 * `created` desc — the deterministic fallback order for unpositioned tasks.
 * Newest first, because rendering an unordered column is most useful with the
 * freshest work on top. `compareTaskReadiness` in `availability.ts` breaks its
 * `created` tie the other way; the two serve different questions and are not
 * expected to agree.
 */
export function byCreatedDesc(a: Task, b: Task): number {
  return Date.parse(b.frontmatter.created) - Date.parse(a.frontmatter.created);
}

/** `updated` desc — how the done column always sorts. */
export function byUpdatedDesc(a: Task, b: Task): number {
  return Date.parse(b.frontmatter.updated) - Date.parse(a.frontmatter.updated);
}

/**
 * Drop a slug from every column.
 *
 * When `existingSlugs` is given, slugs whose task no longer exists are pruned
 * too, which is how a stale `layout.json` heals over time. Omit it to touch
 * nothing but `slug` — rollback paths want that, since they are restoring state
 * rather than reconciling it.
 */
export function layoutWithoutTask(
  layout: BoardLayout,
  slug: string,
  existingSlugs?: ReadonlySet<string>,
): BoardLayout {
  const next: BoardLayout = {};
  for (const [columnId, slugs] of Object.entries(layout)) {
    next[columnId] = slugs.filter(
      candidate =>
        candidate !== slug &&
        (existingSlugs === undefined || existingSlugs.has(candidate)),
    );
  }
  return next;
}

/**
 * The layout after moving `slug` into `toStatus` at `position`.
 *
 * `position` is a 0-based index; `-1` (or past the end) appends. It is computed
 * by callers against the *visible* column — layout order followed by
 * unpositioned tasks in `created` desc order — so this materializes those
 * leftovers into the column array before splicing, keeping the layout a superset
 * of what the user is looking at. Without that step a position computed on
 * screen would land somewhere else in the file.
 *
 * The done column never carries manual order: it time-sorts by `updated`, so its
 * key is dropped entirely.
 */
export function layoutAfterMove({
  layout,
  tasks,
  slug,
  toStatus,
  position,
  doneColumn,
}: {
  layout: BoardLayout;
  /** Every live task. Used for leftovers and for pruning stale slugs. */
  tasks: Task[];
  slug: string;
  toStatus: string;
  position: number;
  doneColumn: string;
}): BoardLayout {
  const existingSlugs = new Set(tasks.map(task => task.slug));
  const next = layoutWithoutTask(layout, slug, existingSlugs);

  delete next[doneColumn];
  if (toStatus === doneColumn) return next;

  const currentOrder = next[toStatus] ?? [];
  const placed = new Set(currentOrder);
  const leftovers = tasks
    .filter(
      task =>
        task.frontmatter.status === toStatus &&
        task.slug !== slug &&
        !placed.has(task.slug),
    )
    .slice()
    .sort(byCreatedDesc)
    .map(task => task.slug);

  const destination = [...currentOrder, ...leftovers];
  const insertAt =
    position < 0 || position > destination.length
      ? destination.length
      : position;
  destination.splice(insertAt, 0, slug);
  next[toStatus] = destination;

  return next;
}

/**
 * The tasks belonging to one column, in render order.
 *
 * - Regular column: `layout[columnId]` order first, then tasks with that status
 *   and no layout entry, `created` desc.
 * - Done column (`columnId === doneColumn`): layout ignored, `updated` desc.
 *   Manual ordering stops meaning anything once work is finished.
 * - Uncategorized (any `columnId` not in `validStatuses`): every task whose
 *   status matches no column, `created` desc. Layout ignored.
 *
 * `doneColumn` is deliberately required. It was optional, and `DetailView`
 * omitted it — so keyboard navigation through the done column ran in a different
 * order than the column being looked at.
 */
export function orderedTasksForColumn(
  tasks: Task[],
  layout: BoardLayout | undefined,
  columnId: string,
  validStatuses: ReadonlySet<string>,
  doneColumn: string,
): Task[] {
  if (!validStatuses.has(columnId)) {
    return tasks
      .filter(task => !validStatuses.has(task.frontmatter.status))
      .slice()
      .sort(byCreatedDesc);
  }

  if (columnId === doneColumn) {
    return tasks
      .filter(task => task.frontmatter.status === columnId)
      .slice()
      .sort(byUpdatedDesc);
  }

  const inColumn = tasks.filter(task => task.frontmatter.status === columnId);
  const bySlug = new Map(inColumn.map(task => [task.slug, task]));

  const ordered: Task[] = [];
  const placed = new Set<string>();
  for (const slug of layout?.[columnId] ?? []) {
    const task = bySlug.get(slug);
    if (task) {
      ordered.push(task);
      placed.add(slug);
    }
  }

  const leftovers = inColumn
    .filter(task => !placed.has(task.slug))
    .slice()
    .sort(byCreatedDesc);

  return [...ordered, ...leftovers];
}
