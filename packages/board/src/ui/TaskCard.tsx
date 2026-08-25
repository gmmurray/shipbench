import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '@shipbench/core';
import { RxLink2 } from 'react-icons/rx';
import { useBoardStore } from '../store/BoardStoreProvider.js';
import { PriorityMeter } from './PriorityMeter.js';

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
}

export function TaskCard({
  task,
  status,
  draggable = false,
  isPlaceholder = false,
}: TaskCardProps) {
  if (draggable) {
    return (
      <SortableTaskCard
        task={task}
        status={status}
        isPlaceholder={isPlaceholder}
      />
    );
  }
  return <StaticTaskCard task={task} />;
}

function SortableTaskCard({
  task,
  status,
  isPlaceholder,
}: {
  task: Task;
  status: string;
  isPlaceholder: boolean;
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
      <StaticTaskCard task={task} dimmed={isPlaceholder} />
    </div>
  );
}

function StaticTaskCard({
  task,
  dimmed = false,
}: {
  task: Task;
  dimmed?: boolean;
}) {
  const selectTask = useBoardStore(state => state.selectTask);
  const errorAt = useBoardStore(state => state.errorAtBySlug[task.slug]);
  const priorityValues = useBoardStore(
    state => state.config?.priority.values ?? NO_PRIORITY_VALUES,
  );
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
        dimmed ? 'opacity-40' : ''
      } ${errorAt ? 'sb-error-shake' : ''}`}
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
      </button>
    </article>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="max-w-full truncate rounded border border-sb-iron px-1.5 py-0.5 font-mono text-[11px] text-sb-silver">
      {label}
    </span>
  );
}
