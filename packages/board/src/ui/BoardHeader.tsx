import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  RxArchive,
  RxLockClosed,
  RxMagnifyingGlass,
  RxUpdate,
} from 'react-icons/rx';
import { useBoardStore } from '../store/BoardStoreProvider.js';
import { relativeTime } from '../utils/time.js';
import { BoardThemeToggle } from './BoardThemeToggle.js';
import { Chevron } from './Chevron.js';
import { NewTaskDialog } from './NewTaskDialog.js';

const SEARCH_DEBOUNCE_MS = 200;

export function BoardHeader({
  themeControl = false,
}: {
  themeControl?: boolean;
}) {
  const headerRef = useRef<HTMLElement>(null);
  const config = useBoardStore(state => state.config);
  const selectedTaskSlug = useBoardStore(state => state.selectedTaskSlug);
  const archiveViewOpen = useBoardStore(state => state.archiveViewOpen);
  const selectedTask = useBoardStore(state =>
    state.selectedTaskSlug
      ? state.tasks.find(t => t.slug === state.selectedTaskSlug)
      : null,
  );
  const selectTask = useBoardStore(state => state.selectTask);
  const openArchive = useBoardStore(state => state.openArchive);
  const closeArchive = useBoardStore(state => state.closeArchive);
  const refresh = useBoardStore(state => state.refresh);
  const isSyncing = useBoardStore(state => state.isSyncing);
  const lastSyncedAt = useBoardStore(state => state.lastSyncedAt);
  const setSearchQuery = useBoardStore(state => state.setSearchQuery);
  const readOnly = useBoardStore(state => state.readOnly);
  const [draftSearch, setDraftSearch] = useState('');

  useLayoutEffect(() => {
    const header = headerRef.current;
    const boardRoot = header?.parentElement;
    if (!header || !boardRoot) return;

    const updateHeaderHeight = () => {
      const height = header.getBoundingClientRect().height;
      if (height > 0) {
        boardRoot.style.setProperty('--sb-header-h', `${height}px`);
      }
    };

    updateHeaderHeight();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(updateHeaderHeight);
    observer?.observe(header);
    window.addEventListener('resize', updateHeaderHeight);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateHeaderHeight);
      boardRoot.style.removeProperty('--sb-header-h');
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(draftSearch);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [draftSearch, setSearchQuery]);

  const projectName = config?.name ?? '';

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-10 border-b border-sb-iron bg-sb-canvas/95 px-5 py-3"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-2 font-mono text-[12px]"
        >
          {projectName ? (
            <>
              <span className="truncate text-sb-silver">{projectName}</span>
              <Separator />
            </>
          ) : null}
          <BreadcrumbSegment
            label="Tasks"
            isCurrent={!selectedTaskSlug && !archiveViewOpen}
            onClick={() => {
              closeArchive();
              selectTask(null);
            }}
          />
          {archiveViewOpen ? (
            <>
              <Separator />
              <span aria-current="page" className="truncate text-sb-frosted">
                Archive
              </span>
            </>
          ) : selectedTaskSlug ? (
            <>
              <Separator />
              <span className="truncate text-sb-frosted">
                {selectedTask?.frontmatter.title ?? selectedTaskSlug}
              </span>
            </>
          ) : null}
        </nav>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {archiveViewOpen ? null : (
            <label className="relative block min-w-0 sm:w-80">
              <RxMagnifyingGlass
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sb-silver"
              />
              <input
                className="h-9 w-full rounded border border-sb-iron bg-sb-surface2 pl-9 pr-3 font-mono text-[12px] text-sb-frosted outline-none transition-colors placeholder:text-sb-silver hover:border-sb-silver focus:border-sb-silver"
                placeholder="Search tasks"
                value={draftSearch}
                onChange={event => setDraftSearch(event.target.value)}
              />
            </label>
          )}

          {readOnly ? (
            <span className="inline-flex h-9 items-center justify-center gap-2 rounded border border-sb-iron bg-sb-surface2 px-3 font-mono text-[11px] uppercase tracking-[0.12em] text-sb-silver">
              <RxLockClosed aria-hidden="true" className="h-3.5 w-3.5" />
              Read only
            </span>
          ) : (
            <button
              aria-pressed={archiveViewOpen}
              className={`inline-flex h-9 items-center justify-center gap-2 rounded border px-3 font-mono text-[11px] transition-colors hover:border-sb-silver hover:bg-sb-surface2 hover:text-sb-frosted ${
                archiveViewOpen
                  ? 'border-sb-silver bg-sb-surface2 text-sb-frosted'
                  : 'border-sb-iron bg-transparent text-sb-silver'
              }`}
              type="button"
              onClick={openArchive}
            >
              <RxArchive aria-hidden="true" className="h-3.5 w-3.5" />
              Archive
            </button>
          )}

          <button
            className="inline-flex h-9 items-center justify-center gap-2 rounded border border-sb-iron bg-transparent px-3 font-mono text-[11px] text-sb-silver transition-colors hover:border-sb-silver hover:bg-sb-surface2 hover:text-sb-frosted disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            disabled={isSyncing}
            onClick={() => void refresh()}
          >
            <RxUpdate
              aria-hidden="true"
              className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`}
            />
            {lastSyncedAt ? `Synced ${relativeTime(lastSyncedAt)}` : 'Sync'}
          </button>

          {readOnly ? null : <NewTaskDialog />}

          {themeControl ? <BoardThemeToggle /> : null}
        </div>
      </div>
    </header>
  );
}

function BreadcrumbSegment({
  label,
  isCurrent,
  onClick,
}: {
  label: string;
  isCurrent: boolean;
  onClick: () => void;
}) {
  if (isCurrent) {
    return (
      <span aria-current="page" className="text-sb-frosted">
        {label}
      </span>
    );
  }
  return (
    <button
      className="text-sb-silver transition-colors hover:text-sb-frosted"
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function Separator() {
  return <Chevron className="h-2.5 w-2.5 shrink-0 text-sb-iron" />;
}
