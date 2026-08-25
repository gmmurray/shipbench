import { useMemo, useState } from 'react';
import { RxArchive, RxMagnifyingGlass, RxReset } from 'react-icons/rx';
import { useBoardStore } from '../store/BoardStoreProvider.js';
import { relativeTime } from '../utils/time.js';

export function ArchiveView() {
  const archivedTasks = useBoardStore(state => state.archivedTasks);
  const archiveWarnings = useBoardStore(state => state.archiveWarnings);
  const isLoading = useBoardStore(state => state.isArchiveLoading);
  const loadError = useBoardStore(state => state.archiveLoadError);
  const liveSearchQuery = useBoardStore(state => state.searchQuery);
  const loadArchivedTasks = useBoardStore(state => state.loadArchivedTasks);
  const unarchiveTask = useBoardStore(state => state.unarchiveTask);
  const [filter, setFilter] = useState(liveSearchQuery);
  const [restoringSlugs, setRestoringSlugs] = useState<Set<string>>(
    () => new Set(),
  );

  const filteredTasks = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const matches = (archivedTasks ?? []).filter(task => {
      if (!query) return true;
      return [
        task.frontmatter.title,
        task.slug,
        task.frontmatter.status,
        task.frontmatter.assignee ?? '',
        ...(task.frontmatter.tags ?? []),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
    return matches.sort(
      (a, b) =>
        Date.parse(b.frontmatter.updated) - Date.parse(a.frontmatter.updated),
    );
  }, [archivedTasks, filter]);

  const restore = async (slug: string) => {
    setRestoringSlugs(current => new Set(current).add(slug));
    try {
      await unarchiveTask(slug);
    } finally {
      setRestoringSlugs(current => {
        const next = new Set(current);
        next.delete(slug);
        return next;
      });
    }
  };

  return (
    <section className="mx-auto max-w-5xl rounded-md border border-sb-iron bg-sb-canvas">
      <div className="flex flex-col gap-4 border-b border-sb-iron px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <RxArchive aria-hidden="true" className="h-4 w-4 text-sb-silver" />
            <h1 className="font-mono text-[11px] uppercase tracking-[0.18em] text-sb-frosted">
              Archive
            </h1>
            {archivedTasks ? (
              <span className="rounded border border-sb-iron px-1.5 py-0.5 font-mono text-[11px] text-sb-silver">
                {archivedTasks.length}
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-[13px] text-sb-silver">
            Browse filed tasks and restore them to their saved status.
          </p>
        </div>

        <label className="relative block min-w-0 sm:w-80">
          <span className="sr-only">Filter archived tasks</span>
          <RxMagnifyingGlass
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sb-silver"
          />
          <input
            aria-label="Filter archived tasks"
            className="h-9 w-full rounded border border-sb-iron bg-sb-surface2 pl-9 pr-3 font-mono text-[12px] text-sb-frosted outline-none transition-colors placeholder:text-sb-silver hover:border-sb-silver focus:border-sb-silver"
            placeholder="Filter archive"
            value={filter}
            onChange={event => setFilter(event.target.value)}
          />
        </label>
      </div>

      {archiveWarnings.length > 0 ? (
        <p className="border-b border-sb-iron px-4 py-2 font-mono text-[11px] text-sb-silver">
          {archiveWarnings.length}{' '}
          {archiveWarnings.length === 1
            ? 'archived task has'
            : 'archived tasks have'}{' '}
          validation warnings.
        </p>
      ) : null}

      <div className="p-4">
        {isLoading && archivedTasks === null ? (
          <ArchiveMessage label="Loading archived tasks..." />
        ) : loadError && archivedTasks === null ? (
          <div className="rounded-md border border-dashed border-sb-iron px-4 py-10 text-center">
            <p className="font-mono text-[12px] text-sb-silver">
              Archive unavailable: {loadError}
            </p>
            <button
              className="mt-4 inline-flex h-9 items-center gap-2 rounded border border-sb-iron bg-transparent px-3 text-[13px] font-medium text-sb-frosted transition-colors hover:border-sb-silver hover:bg-sb-surface2"
              type="button"
              onClick={() => void loadArchivedTasks()}
            >
              <RxReset aria-hidden="true" className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : filteredTasks.length === 0 ? (
          <ArchiveMessage
            label={
              archivedTasks?.length
                ? 'No archived tasks match this filter.'
                : 'Archive is empty.'
            }
          />
        ) : (
          <ul aria-label="Archived tasks" className="space-y-2">
            {filteredTasks.map(task => {
              const restoring = restoringSlugs.has(task.slug);
              return (
                <li
                  className="flex flex-col gap-3 rounded-md border border-sb-iron bg-sb-surface p-3 transition-colors hover:border-sb-silver sm:flex-row sm:items-center sm:justify-between"
                  key={task.slug}
                >
                  <div className="min-w-0">
                    <p className="truncate font-sans text-[14px] font-medium text-sb-frosted">
                      {task.frontmatter.title}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-sb-silver">
                      {task.slug}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded border border-sb-iron px-2 py-1 font-mono text-[11px] text-sb-silver">
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 bg-sb-frosted"
                      />
                      {task.frontmatter.status}
                    </span>
                    <time
                      className="font-mono text-[11px] text-sb-silver"
                      dateTime={task.frontmatter.updated}
                      title={task.frontmatter.updated}
                    >
                      Updated {relativeTime(task.frontmatter.updated)}
                    </time>
                    <button
                      aria-label={`Unarchive ${task.frontmatter.title}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded border border-sb-iron bg-transparent px-2.5 text-[12px] font-medium text-sb-frosted transition-colors hover:border-sb-silver hover:bg-sb-surface2 disabled:cursor-not-allowed disabled:opacity-40"
                      type="button"
                      disabled={restoring}
                      onClick={() => void restore(task.slug)}
                    >
                      <RxReset aria-hidden="true" className="h-3.5 w-3.5" />
                      {restoring ? 'Restoring...' : 'Unarchive'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function ArchiveMessage({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-sb-iron px-4 py-12 text-center font-mono text-[12px] text-sb-silver">
      {label}
    </div>
  );
}
