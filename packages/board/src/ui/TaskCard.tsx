import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, TaskSearchMatch } from '@shipbench/core';
// From the pure subpath, never the barrel: see the note in boardSearch.ts.
import { type TaskFlag, taskFlag } from '@shipbench/core/flag';
import { RxExclamationTriangle, RxLink2 } from 'react-icons/rx';
import { useBoardStore } from '../store/BoardStoreProvider.js';
import { PriorityMeter } from './PriorityMeter.js';
import { SearchMatchContext } from './SearchMatchContext.js';

/**
 * Shared empty fallback for store selectors. zustand v5 reads through a plain
 * `useSyncExternalStore` with no equality function, so a selector that builds a
 * fresh value on every call never compares equal and re-renders forever —
 * React's "Maximum update depth exceeded". Selector fallbacks must be stable
 * references, never inline literals.
 */
const NO_PRIORITY_VALUES: string[] = [];

interface TaskCardProps {
  task: Task;
  status: string;
  /** When true, the card is wired up to dnd-kit as a sortable source. */
  draggable?: boolean;
  /** When true, render the card as a placeholder shadow (overlay handles the real one). */
  isPlaceholder?: boolean;
  /** Set during a search the card face cannot explain; shows where it matched. */
  searchMatch?: TaskSearchMatch | undefined;
}

export function TaskCard({
  task,
  status,
  draggable = false,
  isPlaceholder = false,
  searchMatch,
}: TaskCardProps) {
  if (draggable) {
    return (
      <SortableTaskCard
        task={task}
        status={status}
        isPlaceholder={isPlaceholder}
        searchMatch={searchMatch}
      />
    );
  }
  return <StaticTaskCard task={task} searchMatch={searchMatch} />;
}

function SortableTaskCard({
  task,
  status,
  isPlaceholder,
  searchMatch,
}: {
  task: Task;
  status: string;
  isPlaceholder: boolean;
  searchMatch: TaskSearchMatch | undefined;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: task.slug,
      data: { status },
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <StaticTaskCard
        task={task}
        dimmed={isPlaceholder}
        searchMatch={searchMatch}
      />
    </div>
  );
}

function StaticTaskCard({
  task,
  dimmed = false,
  searchMatch,
}: {
  task: Task;
  dimmed?: boolean;
  searchMatch: TaskSearchMatch | undefined;
}) {
  const selectTask = useBoardStore(state => state.selectTask);
  const errorAt = useBoardStore(state => state.errorAtBySlug[task.slug]);
  const priorityValues = useBoardStore(
    state => state.config?.priority.values ?? NO_PRIORITY_VALUES,
  );
  const isDone = useBoardStore(
    state => state.config?.done_column === task.frontmatter.status,
  );
  const flag = taskFlag(task);
  // A flag on a finished task is most likely one nobody cleared. It stays
  // visible but drops the warning hue, which is reserved for live attention.
  const raised = flag !== null && !isDone;
  const unfinishedDependencyCount = useBoardStore(state => {
    const dependencies = task.frontmatter.depends_on ?? [];
    if (!dependencies.length || !state.config) return 0;

    return dependencies.filter(dependency => {
      const target = state.tasks.find(
        candidate => candidate.slug === dependency,
      );
      return !target || target.frontmatter.status !== state.config?.done_column;
    }).length;
  });

  return (
    <article
      className={`rounded-md border border-sb-iron bg-sb-surface p-3 outline-none transition-colors hover:border-sb-silver ${
        raised ? 'border-l-2 border-l-sb-warning hover:border-l-sb-warning' : ''
      } ${dimmed ? 'opacity-40' : ''} ${errorAt ? 'sb-error-shake' : ''}`}
      key={errorAt ?? 'stable'}
    >
      <button
        className="block w-full text-left"
        type="button"
        onClick={() => selectTask(task.slug)}
      >
        <h3 className="line-clamp-2 font-sans text-[14px] font-medium leading-5 text-sb-frosted">
          {task.frontmatter.title}
        </h3>
        <p className="mt-1 truncate font-mono text-[11px] text-sb-silver">
          {task.slug}
        </p>
        {flag ? <FlagLine flag={flag} raised={raised} /> : null}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {task.frontmatter.priority ? (
            <PriorityMeter
              value={task.frontmatter.priority}
              values={priorityValues}
            />
          ) : null}
          {task.frontmatter.assignee ? (
            <Chip label={task.frontmatter.assignee} />
          ) : null}
          {(task.frontmatter.tags ?? []).slice(0, 3).map(tag => (
            <Chip key={tag} label={tag} />
          ))}
          {unfinishedDependencyCount ? (
            // biome-ignore lint/a11y/useAriaPropsSupportedByRole: title alignment
            <span
              className="inline-flex items-center gap-1 rounded border border-sb-ironlit px-1.5 py-0.5 font-mono text-[11px] text-sb-silver"
              aria-label={`${unfinishedDependencyCount} unfinished ${
                unfinishedDependencyCount === 1 ? 'dependency' : 'dependencies'
              }`}
              title={`${unfinishedDependencyCount} unfinished ${
                unfinishedDependencyCount === 1 ? 'dependency' : 'dependencies'
              }`}
            >
              <RxLink2 aria-hidden="true" className="h-3 w-3" />
              {unfinishedDependencyCount}
            </span>
          ) : null}
        </div>

        {searchMatch ? <SearchMatchContext match={searchMatch} /> : null}
      </button>
    </article>
  );
}

function FlagLine({ flag, raised }: { flag: TaskFlag; raised: boolean }) {
  return (
    <p
      className="mt-2 flex items-start gap-1.5 text-[12px] leading-4 text-sb-silver"
      title={flag.reason ?? undefined}
    >
      <RxExclamationTriangle
        aria-hidden="true"
        className={`mt-0.5 h-3 w-3 shrink-0 ${raised ? 'text-sb-warning' : ''}`}
      />
      {flag.reason ? (
        <span className="line-clamp-2 min-w-0 break-words">
          <span className="sr-only">Flagged: </span>
          {flag.reason}
        </span>
      ) : (
        <span>Flagged</span>
      )}
    </p>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="max-w-full truncate rounded border border-sb-iron px-1.5 py-0.5 font-mono text-[11px] text-sb-silver">
      {label}
    </span>
  );
}
