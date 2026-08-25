import type {
  BoardAPI,
  BoardLayout,
  ShipbenchConfig,
  Task,
  TaskFrontmatter,
  TaskValidationWarning,
} from '@shipbench/core';
// Values come from the pure `layout` subpath, never the barrel: the barrel
// re-exports FsAdapter, which imports `node:fs` and cannot be bundled for the
// browser. See AGENTS.md on the core/board boundary.
import {
  layoutAfterMove,
  layoutWithoutTask,
  orderedTasksForColumn,
} from '@shipbench/core/layout';
import { toast } from 'sonner';
import { createStore, type StoreApi } from 'zustand/vanilla';

export const UNCATEGORIZED_STATUS = '__uncategorized__';

export interface BoardState {
  /**
   * Snapshotted from `api.readOnly` at store creation. Swapping modes means
   * providing a new `BoardAPI` — `BoardStoreProvider` recreates the store
   * whenever the api reference changes.
   */
  readOnly: boolean;
  /**
   * Snapshotted from `api.resolveRepoLink` on the same terms as `readOnly`.
   * `null` when the host cannot point at repo files — the Markdown renderer
   * then shows those links as plain paths instead of anchors that 404.
   */
  resolveRepoLink: ((repoRelativePath: string) => string | null) | null;
  config: ShipbenchConfig | null;
  tasks: Task[];
  warnings: TaskValidationWarning[];
  archiveViewOpen: boolean;
  archivedTasks: Task[] | null;
  archiveWarnings: TaskValidationWarning[];
  isArchiveLoading: boolean;
  archiveLoadError: string | null;
  selectedTaskSlug: string | null;
  searchQuery: string;
  lastSyncedAt: number | null;
  isSyncing: boolean;
  hasLoaded: boolean;
  initialLoadError: string | null;
  errorAtBySlug: Record<string, number>;
  refresh: () => Promise<void>;
  moveTask: (slug: string, toStatus: string) => Promise<void>;
  reorderTask: (
    slug: string,
    toStatus: string,
    position: number,
  ) => Promise<void>;
  updateTask: (
    slug: string,
    fields: Partial<TaskFrontmatter>,
    body?: string,
  ) => Promise<void>;
  addComment: (slug: string, text: string) => Promise<boolean>;
  editComment: (slug: string, index: number, text: string) => Promise<boolean>;
  deleteComment: (slug: string, index: number) => Promise<boolean>;
  createTask: (
    title: string,
    fields?: Partial<TaskFrontmatter>,
  ) => Promise<void>;
  archiveTask: (slug: string, force?: boolean) => Promise<void>;
  unarchiveTask: (slug: string) => Promise<void>;
  openArchive: () => void;
  closeArchive: () => void;
  loadArchivedTasks: () => Promise<void>;
  deleteTask: (slug: string) => Promise<void>;
  selectTask: (slug: string | null) => void;
  setSearchQuery: (query: string) => void;
}

export type BoardStore = StoreApi<BoardState>;

export function createBoardStore(api: BoardAPI): BoardStore {
  const archivedPositions = new Map<
    string,
    { status: string; position: number }
  >();

  /**
   * Slugs with an in-flight mutation, counted (a slug can have more than one
   * queued). A `refresh()` must not overwrite a slug that is mid-mutation: the
   * server read predates the write, so applying it reverts the card until the
   * write lands. The mutation's own response is authoritative — core recomputes
   * layout from disk on settle — so deferring to it also picks up whatever
   * external change the refresh was reporting.
   */
  const pendingMutations = new Map<string, number>();

  /**
   * Set when a `refresh()` landed while a mutation was in flight, so its layout
   * was held back. Layout is whole-board, so preserving the local copy also
   * discards any unrelated external reordering that read was carrying. Under the
   * CLI `SyncEffects` is event-driven with no polling fallback, so that dropped
   * read has no natural retry — we owe it one once the board goes quiet.
   */
  let readSuppressed = false;
  let store: BoardStore | undefined;

  function beginMutation(slug: string): void {
    pendingMutations.set(slug, (pendingMutations.get(slug) ?? 0) + 1);
  }

  function endMutation(slug: string): void {
    const remaining = (pendingMutations.get(slug) ?? 0) - 1;
    if (remaining > 0) {
      pendingMutations.set(slug, remaining);
      return;
    }
    pendingMutations.delete(slug);

    if (pendingMutations.size === 0 && readSuppressed) {
      readSuppressed = false;
      // Nothing is pending now, so this re-read takes the straight-replace path
      // and cannot suppress itself — no loop.
      void store?.getState().refresh();
    }
  }

  store = createStore<BoardState>((set, get) => ({
    readOnly: Boolean(api.readOnly),
    // Wrapped rather than passed by reference so `api` stays the receiver.
    resolveRepoLink: api.resolveRepoLink
      ? path => api.resolveRepoLink?.(path) ?? null
      : null,
    config: null,
    tasks: [],
    warnings: [],
    archiveViewOpen: false,
    archivedTasks: null,
    archiveWarnings: [],
    isArchiveLoading: false,
    archiveLoadError: null,
    selectedTaskSlug: null,
    searchQuery: '',
    lastSyncedAt: null,
    isSyncing: false,
    hasLoaded: false,
    initialLoadError: null,
    errorAtBySlug: {},

    refresh: async () => {
      set({ isSyncing: true });

      try {
        const [config, taskResult] = await Promise.all([
          api.getConfig(),
          api.listTasks(),
        ]);

        if (pendingMutations.size > 0) readSuppressed = true;

        set(state => ({
          ...mergeServerRead(state, config, taskResult, pendingMutations),
          lastSyncedAt: Date.now(),
          isSyncing: false,
          hasLoaded: true,
          initialLoadError: null,
        }));
      } catch (error) {
        const message = errorMessage(error);

        if (!get().hasLoaded) {
          set({ initialLoadError: message, isSyncing: false });
          return;
        }

        set({ isSyncing: false });
        toast.error(`Sync failed: ${message}`);
      }
    },

    moveTask: async (slug, toStatus) => {
      // Convenience wrapper — appends to the destination column.
      await get().reorderTask(slug, toStatus, -1);
    },

    reorderTask: async (slug, toStatus, position) => {
      const snapshot = snapshotTask(get(), slug);
      if (!snapshot.task) return;

      set(state => ({
        tasks: state.tasks.map(item =>
          item.slug === slug
            ? {
                ...item,
                frontmatter: { ...item.frontmatter, status: toStatus },
              }
            : item,
        ),
        config: state.config
          ? {
              ...state.config,
              layout: layoutAfterMove({
                layout: state.config.layout ?? {},
                tasks: state.tasks,
                slug,
                toStatus,
                position,
                doneColumn: state.config.done_column,
              }),
            }
          : null,
      }));

      beginMutation(slug);
      try {
        const { task: saved, layout } = await api.reorderTask(
          slug,
          toStatus,
          position,
        );
        set(state => ({
          tasks: state.tasks.map(item => (item.slug === slug ? saved : item)),
          config: state.config ? { ...state.config, layout } : null,
        }));
      } catch (error) {
        rollbackTask(set, snapshot, `Move failed: ${errorMessage(error)}`);
      } finally {
        endMutation(slug);
      }
    },

    updateTask: async (slug, fields, body) => {
      const snapshot = snapshotTask(get(), slug);
      const statusChanged =
        snapshot.task !== undefined &&
        fields.status !== undefined &&
        fields.status !== snapshot.task.frontmatter.status;

      set(state => ({
        tasks: state.tasks.map(task =>
          task.slug === slug
            ? {
                ...task,
                frontmatter: { ...task.frontmatter, ...fields },
                body: body ?? task.body,
              }
            : task,
        ),
        // A status change moves columns; optimistically reflect the move in the
        // layout so the card jumps immediately. `api.updateTask` returns the
        // authoritative layout, which we reconcile once it resolves.
        config:
          statusChanged && state.config
            ? {
                ...state.config,
                layout: layoutAfterMove({
                  layout: state.config.layout ?? {},
                  tasks: state.tasks,
                  slug,
                  toStatus: fields.status as string,
                  position: -1,
                  doneColumn: state.config.done_column,
                }),
              }
            : state.config,
      }));

      beginMutation(slug);
      try {
        // One call: core owns the status→reorder+layout maintenance and hands
        // back the authoritative layout (present only when status changed).
        const { task: saved, layout } = await api.updateTask(
          slug,
          fields,
          body,
        );
        reconcileTask(set, saved, slug);
        if (layout) {
          set(state => ({
            config: state.config ? { ...state.config, layout } : state.config,
          }));
        }

        const updatedFields = new Set(Object.keys(fields));
        if (updatedFields.size) {
          set(state => ({
            warnings: state.warnings.filter(
              warning =>
                warning.slug !== slug || !updatedFields.has(warning.field),
            ),
          }));
        }
      } catch (error) {
        rollbackTask(set, snapshot, `Update failed: ${errorMessage(error)}`);
      } finally {
        endMutation(slug);
      }
    },

    addComment: async (slug, text) => {
      if (get().readOnly) return false;

      const snapshot = snapshotTask(get(), slug);
      if (!snapshot.task || !text.trim()) return false;

      const optimisticTimestamp = new Date().toISOString();
      set(state => ({
        tasks: state.tasks.map(task =>
          task.slug === slug
            ? {
                ...task,
                frontmatter: {
                  ...task.frontmatter,
                  updated: optimisticTimestamp,
                },
                comments: [
                  ...(task.comments ?? []),
                  { timestamp: optimisticTimestamp, text: text.trim() },
                ],
              }
            : task,
        ),
      }));

      beginMutation(slug);
      try {
        const saved = await api.addComment(slug, text);
        reconcileTask(set, saved, slug);
        return true;
      } catch (error) {
        rollbackTask(
          set,
          snapshot,
          `Task update failed: ${errorMessage(error)}`,
        );
        return false;
      } finally {
        endMutation(slug);
      }
    },

    editComment: async (slug, index, text) => {
      if (get().readOnly) return false;

      const snapshot = snapshotTask(get(), slug);
      const normalizedText = text.trim();
      if (
        !snapshot.task ||
        !normalizedText ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= (snapshot.task.comments?.length ?? 0)
      ) {
        return false;
      }

      const optimisticTimestamp = new Date().toISOString();
      set(state => ({
        tasks: state.tasks.map(task =>
          task.slug === slug
            ? {
                ...task,
                frontmatter: {
                  ...task.frontmatter,
                  updated: optimisticTimestamp,
                },
                comments: task.comments.map((comment, commentIndex) =>
                  commentIndex === index
                    ? { ...comment, text: normalizedText }
                    : comment,
                ),
              }
            : task,
        ),
      }));

      beginMutation(slug);
      try {
        const saved = await api.editComment(slug, index, text);
        reconcileTask(set, saved, slug);
        return true;
      } catch (error) {
        rollbackTask(
          set,
          snapshot,
          `Task update edit failed: ${errorMessage(error)}`,
        );
        return false;
      } finally {
        endMutation(slug);
      }
    },

    deleteComment: async (slug, index) => {
      if (get().readOnly) return false;

      const snapshot = snapshotTask(get(), slug);
      if (
        !snapshot.task ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= (snapshot.task.comments?.length ?? 0)
      ) {
        return false;
      }

      const optimisticTimestamp = new Date().toISOString();
      set(state => ({
        tasks: state.tasks.map(task =>
          task.slug === slug
            ? {
                ...task,
                frontmatter: {
                  ...task.frontmatter,
                  updated: optimisticTimestamp,
                },
                comments: task.comments.filter(
                  (_, commentIndex) => commentIndex !== index,
                ),
              }
            : task,
        ),
      }));

      beginMutation(slug);
      try {
        const saved = await api.deleteComment(slug, index);
        reconcileTask(set, saved, slug);
        return true;
      } catch (error) {
        rollbackTask(
          set,
          snapshot,
          `Task update delete failed: ${errorMessage(error)}`,
        );
        return false;
      } finally {
        endMutation(slug);
      }
    },

    createTask: async (title, fields) => {
      const fallbackStatus =
        fields?.status ??
        get().config?.default_column ??
        get().config?.columns.at(0)?.id ??
        UNCATEGORIZED_STATUS;
      const temporarySlug = `new-${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const optimisticTask: Task = {
        slug: temporarySlug,
        frontmatter: {
          title,
          status: fallbackStatus,
          priority: fields?.priority,
          assignee: fields?.assignee,
          tags: fields?.tags,
          depends_on: fields?.depends_on,
          created: now,
          updated: now,
        },
        body: '',
        comments: [],
      };

      // Snapshot first, while the slug still doesn't exist: `task: undefined` is
      // what tells rollback to drop the optimistic row rather than restore it.
      const snapshot = snapshotTask(get(), temporarySlug);
      set(state => ({ tasks: [optimisticTask, ...state.tasks] }));

      beginMutation(temporarySlug);
      try {
        const saved = await api.createTask(title, fields);
        reconcileTask(set, saved, temporarySlug);
      } catch (error) {
        rollbackTask(set, snapshot, `Create failed: ${errorMessage(error)}`);
      } finally {
        endMutation(temporarySlug);
      }
    },

    deleteTask: async slug => {
      const snapshot = snapshotTask(get(), slug);

      set(state => ({
        tasks: state.tasks.filter(task => task.slug !== slug),
        selectedTaskSlug:
          state.selectedTaskSlug === slug ? null : state.selectedTaskSlug,
        config: state.config
          ? {
              ...state.config,
              layout: layoutWithoutTask(state.config.layout ?? {}, slug),
            }
          : null,
      }));

      beginMutation(slug);
      try {
        await api.deleteTask(slug);
      } catch (error) {
        rollbackTask(set, snapshot, `Delete failed: ${errorMessage(error)}`);
      } finally {
        endMutation(slug);
      }
    },

    archiveTask: async (slug, force = false) => {
      const current = get();
      const snapshot = snapshotTask(current, slug);
      const archivedTask = snapshot.task;
      if (!archivedTask) return;
      const status = archivedTask.frontmatter.status;
      const position = current.config
        ? orderedTasksForColumn(
            current.tasks,
            current.config.layout,
            status,
            new Set(current.config.columns.map(column => column.id)),
            current.config.done_column,
          ).findIndex(task => task.slug === slug)
        : -1;

      set(state => ({
        tasks: state.tasks.filter(task => task.slug !== slug),
        selectedTaskSlug:
          state.selectedTaskSlug === slug ? null : state.selectedTaskSlug,
        config: state.config
          ? {
              ...state.config,
              layout: layoutWithoutTask(state.config.layout ?? {}, slug),
            }
          : null,
      }));

      beginMutation(slug);
      try {
        await api.archiveTask(slug, force ? { force: true } : undefined);
        archivedPositions.set(slug, { status, position });
        set(state => ({
          archivedTasks: state.archivedTasks
            ? [
                archivedTask,
                ...state.archivedTasks.filter(task => task.slug !== slug),
              ]
            : null,
        }));
        toast.success('Task archived', {
          description: archivedTask.frontmatter.title,
          action: {
            label: 'Undo',
            onClick: () => void get().unarchiveTask(slug),
          },
        });
      } catch (error) {
        rollbackTask(set, snapshot, `Archive failed: ${errorMessage(error)}`);
      } finally {
        endMutation(slug);
      }
    },

    unarchiveTask: async slug => {
      beginMutation(slug);
      try {
        let restored = await api.unarchiveTask(slug);
        let restoredLayout: BoardLayout | undefined;
        const archivedPosition = archivedPositions.get(slug);
        if (
          archivedPosition &&
          archivedPosition.position >= 0 &&
          restored.frontmatter.status === archivedPosition.status &&
          restored.frontmatter.status !== get().config?.done_column
        ) {
          const reordered = await api.reorderTask(
            restored.slug,
            archivedPosition.status,
            archivedPosition.position,
          );
          restored = reordered.task;
          restoredLayout = reordered.layout;
        }
        archivedPositions.delete(slug);
        set(state => {
          const withoutRestored = state.tasks.filter(
            task => task.slug !== restored.slug,
          );
          const tasks = [restored, ...withoutRestored];
          // No authoritative layout means the restore didn't need a reorder
          // call, so append the task to its column here. `layoutAfterMove`
          // handles the done column (which keeps no manual order) itself.
          const layout =
            restoredLayout ??
            (state.config
              ? layoutAfterMove({
                  layout: state.config.layout ?? {},
                  tasks,
                  slug: restored.slug,
                  toStatus: restored.frontmatter.status,
                  position: -1,
                  doneColumn: state.config.done_column,
                })
              : // No config means no board to place it in; `config` below stays
                // null either way, so the value is inert.
                {});
          return {
            tasks,
            config: state.config ? { ...state.config, layout } : null,
            archivedTasks: state.archivedTasks
              ? state.archivedTasks.filter(task => task.slug !== restored.slug)
              : null,
          };
        });
        toast.success('Task restored', {
          description: restored.frontmatter.title,
        });
      } catch (error) {
        toast.error(`Restore failed: ${errorMessage(error)}`);
      } finally {
        endMutation(slug);
      }
    },

    openArchive: () => {
      if (get().readOnly) return;
      set({ archiveViewOpen: true, selectedTaskSlug: null });
      if (get().archivedTasks === null && !get().isArchiveLoading) {
        void get().loadArchivedTasks();
      }
    },

    closeArchive: () => set({ archiveViewOpen: false }),

    loadArchivedTasks: async () => {
      if (get().readOnly) return;
      set({ isArchiveLoading: true, archiveLoadError: null });
      try {
        const result = await api.listArchivedTasks();
        set({
          archivedTasks: result.tasks,
          archiveWarnings: result.warnings,
          isArchiveLoading: false,
          archiveLoadError: null,
        });
      } catch (error) {
        set({
          isArchiveLoading: false,
          archiveLoadError: errorMessage(error),
        });
      }
    },

    selectTask: selectedTaskSlug => set({ selectedTaskSlug }),
    setSearchQuery: searchQuery => set({ searchQuery }),
  }));

  return store;
}

export function getVisibleTasks(tasks: Task[], searchQuery: string): Task[] {
  const query = searchQuery.trim().toLowerCase();

  if (!query) {
    return tasks;
  }

  return tasks.filter(task => {
    const haystack = [
      task.slug,
      task.frontmatter.title,
      task.frontmatter.assignee ?? '',
      ...(task.frontmatter.tags ?? []),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });
}

/**
 * Fold a server read into local state without trampling in-flight mutations.
 *
 * With nothing pending this is a straight replace. Otherwise every slug that is
 * mid-mutation keeps its local (optimistic) task and warnings, and the local
 * layout is preserved wholesale — layout is a whole-board structure, so a
 * pending move has already rewritten it and the settle response will replace it
 * with the authoritative version.
 */
function mergeServerRead(
  state: BoardState,
  config: ShipbenchConfig,
  read: { tasks: Task[]; warnings: TaskValidationWarning[] },
  pending: ReadonlyMap<string, number>,
): Pick<BoardState, 'config' | 'tasks' | 'warnings'> {
  if (pending.size === 0) {
    return { config, tasks: read.tasks, warnings: read.warnings };
  }

  const localBySlug = new Map(state.tasks.map(task => [task.slug, task]));
  const serverSlugs = new Set(read.tasks.map(task => task.slug));

  const tasks = read.tasks
    // A slug pending deletion or archival is already gone locally. Dropping it
    // here keeps it gone — otherwise the refresh resurrects it mid-flight.
    .filter(task => !pending.has(task.slug) || localBySlug.has(task.slug))
    // Only a pending slug keeps its local version. Everything else takes the
    // server's, so an external edit to an unrelated task still comes through.
    .map(task =>
      pending.has(task.slug) ? (localBySlug.get(task.slug) ?? task) : task,
    );

  // Pending slugs the server hasn't seen yet — an optimistic create, or a task
  // written after this read was taken — survive the refresh.
  for (const [slug, task] of localBySlug) {
    if (pending.has(slug) && !serverSlugs.has(slug)) tasks.push(task);
  }

  return {
    config: { ...config, layout: state.config?.layout ?? config.layout },
    tasks,
    warnings: [
      ...read.warnings.filter(warning => !pending.has(warning.slug)),
      ...state.warnings.filter(warning => pending.has(warning.slug)),
    ],
  };
}

interface TaskSnapshot {
  slug: string;
  /** The task as it was, or undefined if it did not exist yet (a create). */
  task: Task | undefined;
  /** Where the slug sat in `layout`, so rollback can put it back exactly. */
  column: string | null;
  index: number;
  selectedTaskSlug: string | null;
}

/**
 * Capture just enough to undo one slug's mutation.
 *
 * Deliberately per-slug rather than a whole-board snapshot: a board-wide
 * snapshot taken at call time also captures every *other* task, so rolling it
 * back discards server-authoritative results that landed while this request was
 * in flight.
 */
function snapshotTask(state: BoardState, slug: string): TaskSnapshot {
  let column: string | null = null;
  let index = -1;

  for (const [columnId, slugs] of Object.entries(state.config?.layout ?? {})) {
    const found = slugs.indexOf(slug);
    if (found >= 0) {
      column = columnId;
      index = found;
      break;
    }
  }

  return {
    slug,
    task: state.tasks.find(task => task.slug === slug),
    column,
    index,
    selectedTaskSlug: state.selectedTaskSlug,
  };
}

function reconcileTask(
  set: StoreApi<BoardState>['setState'],
  saved: Task,
  previousSlug: string,
) {
  set(state => ({
    tasks: state.tasks.some(task => task.slug === previousSlug)
      ? state.tasks.map(task => (task.slug === previousSlug ? saved : task))
      : [saved, ...state.tasks],
    selectedTaskSlug:
      state.selectedTaskSlug === previousSlug
        ? saved.slug
        : state.selectedTaskSlug,
  }));
}

/**
 * Undo one slug's failed mutation, leaving every other task and any layout
 * change that landed meanwhile intact.
 */
function rollbackTask(
  set: StoreApi<BoardState>['setState'],
  snapshot: TaskSnapshot,
  message: string,
) {
  const errorAt = Date.now();
  const { slug, task } = snapshot;

  set(state => {
    const present = state.tasks.some(candidate => candidate.slug === slug);
    const tasks = task
      ? present
        ? state.tasks.map(candidate =>
            candidate.slug === slug ? task : candidate,
          )
        : [task, ...state.tasks]
      : // No prior task means this was a create — drop the optimistic row.
        state.tasks.filter(candidate => candidate.slug !== slug);

    // Re-seat the slug where it was in the layout, on top of whatever the
    // layout looks like now rather than on top of a stale copy of it.
    const layout = layoutWithoutTask(state.config?.layout ?? {}, slug);
    if (snapshot.column !== null) {
      const column = [...(layout[snapshot.column] ?? [])];
      column.splice(Math.min(snapshot.index, column.length), 0, slug);
      layout[snapshot.column] = column;
    }
    // Drop columns the optimistic move emptied. `layout[col] ?? []` treats
    // missing and empty identically, so this only removes noise — but it keeps
    // a rolled-back layout byte-identical to the one we started from.
    for (const [columnId, slugs] of Object.entries(layout)) {
      if (slugs.length === 0) delete layout[columnId];
    }

    return {
      tasks,
      // Archive and delete clear the selection optimistically, so by now it is
      // null rather than `slug` — restore it when this slug was the one open.
      selectedTaskSlug:
        snapshot.selectedTaskSlug === slug && state.selectedTaskSlug === null
          ? slug
          : state.selectedTaskSlug,
      config: state.config ? { ...state.config, layout } : state.config,
      errorAtBySlug: { ...state.errorAtBySlug, [slug]: errorAt },
    };
  });
  toast.error(message);

  globalThis.setTimeout(() => {
    set(state => {
      if (state.errorAtBySlug[slug] !== errorAt) {
        return state;
      }

      const errorAtBySlug = { ...state.errorAtBySlug };
      delete errorAtBySlug[slug];
      return { errorAtBySlug };
    });
  }, 350);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
