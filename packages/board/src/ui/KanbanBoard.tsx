import {
  type ClientRect,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  type UniqueIdentifier,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import type { ShipbenchConfig, Task } from '@shipbench/core';
import { orderedTasksForColumn } from '@shipbench/core/layout';
import { useMemo, useState } from 'react';
import { RxArchive, RxMagnifyingGlass, RxPlus } from 'react-icons/rx';
import { useBoardStore } from '../store/BoardStoreProvider.js';
import { getVisibleTasks, UNCATEGORIZED_STATUS } from '../store/boardStore.js';
import { NewTaskDialog } from './NewTaskDialog.js';
import { TaskCard } from './TaskCard.js';

interface Column {
  id: string;
  label: string;
  tasks: Task[];
  /** True if this column should time-sort and disable manual reorder. */
  isDone: boolean;
}

/**
 * Build the rendered columns from board data alone.
 *
 * The absent parameter is the point: **nothing about the in-progress drag may
 * influence what is rendered.** dnd-kit derives `over` during render from the
 * measured droppable rects and dispatches `onDragOver` from an effect keyed on
 * it, so a preview that reorders or re-parents cards changes those rects, flips
 * `over`, and re-enters the handler with the pointer stationary — an undamped
 * loop that ends in React's "Maximum update depth exceeded" (#185).
 *
 * Keeping preview state out of this signature makes that class of bug a type
 * error rather than something a test has to catch. The drop target is shown
 * instead by an absolutely-positioned indicator, which occupies no space and so
 * cannot move anything. See docs/audits/board-move-algorithm-audit.md.
 */
export function buildColumns(
  config: ShipbenchConfig,
  visibleTasks: Task[],
  validStatuses: Set<string>,
): Column[] {
  const uncategorizedTasks = orderedTasksForColumn(
    visibleTasks,
    config.layout,
    UNCATEGORIZED_STATUS,
    validStatuses,
    config.done_column,
  );

  return [
    ...config.columns.map(column => ({
      id: column.id,
      label: column.label,
      tasks: orderedTasksForColumn(
        visibleTasks,
        config.layout,
        column.id,
        validStatuses,
        config.done_column,
      ),
      isDone: column.id === config.done_column,
    })),
    ...(uncategorizedTasks.length > 0
      ? [
          {
            id: UNCATEGORIZED_STATUS,
            label: 'Uncategorized',
            tasks: uncategorizedTasks,
            isDone: false,
          },
        ]
      : []),
  ];
}

/**
 * Where to draw the insertion line, as an index into the column's *rendered*
 * task list (`tasks.length` meaning "after the last card").
 *
 * `previewPosition` counts positions among the drop candidates, which exclude
 * the dragged card. The dragged card is still rendered in place (dimmed), so a
 * same-column drag has to step over it to land on the right gap.
 */
export function indicatorIndexForColumn(
  tasks: Task[],
  activeSlug: string,
  previewPosition: number,
): number {
  const activeIndex = tasks.findIndex(task => task.slug === activeSlug);
  const candidateCount = activeIndex >= 0 ? tasks.length - 1 : tasks.length;
  const position =
    previewPosition < 0 || previewPosition > candidateCount
      ? candidateCount
      : previewPosition;

  if (activeIndex < 0) return position;
  return position < activeIndex ? position : position + 1;
}

/**
 * Collision detection that keeps the gaps between cards attached to a card.
 *
 * `pointerWithin` already ranks a card above the column behind it — a card's
 * rect corners are much nearer the pointer than a tall column's. But the column
 * body uses `gap-3`, so there is a 12px band between every pair of cards where
 * no card contains the pointer and the column wins outright. `resolveDragOver`
 * reads a column hit as "empty space, send to the tail", so dragging up a column
 * made the indicator flick to the bottom each time the pointer crossed a gap —
 * and releasing in one sent the task to the bottom.
 *
 * Gaps belong to the card below them. Only space past the last card is genuinely
 * empty and means "tail".
 */
export const cardsOverColumns: CollisionDetection = args => {
  const { droppableContainers, droppableRects, pointerCoordinates } = args;
  const within = pointerWithin(args);
  if (!pointerCoordinates || within.length === 0) return within;

  const onCard = within.find(
    collision =>
      collision.data?.droppableContainer?.data?.current?.isColumn !== true,
  );
  if (onCard) return [onCard];

  const status = within[0]?.data?.droppableContainer?.data?.current?.status;
  if (typeof status !== 'string') return within;

  const cards = droppableContainers
    .filter(
      container =>
        container.data.current?.isColumn !== true &&
        container.data.current?.status === status,
    )
    .map(container => ({
      id: container.id,
      rect: droppableRects.get(container.id),
    }))
    .filter(
      (candidate): candidate is { id: UniqueIdentifier; rect: ClientRect } =>
        candidate.rect !== undefined,
    )
    .sort((a, b) => a.rect.top - b.rect.top);

  // The first card whose bottom edge is still below the pointer owns this gap.
  const target = cards.find(
    card => pointerCoordinates.y <= card.rect.top + card.rect.height,
  );

  return target ? [{ id: target.id }] : within;
};

/**
 * Sorting strategy that never returns a transform.
 *
 * dnd-kit's default strategies slide the surrounding cards to make room, which
 * moves their measured rects mid-drag — the same reflexive geometry the
 * projection used to cause. The insertion indicator communicates the drop
 * position instead, so cards stay exactly where they are for the whole drag.
 */
const staticSortingStrategy = () => null;

export function KanbanBoard() {
  const config = useBoardStore(state => state.config);
  const tasks = useBoardStore(state => state.tasks);
  const searchQuery = useBoardStore(state => state.searchQuery);
  const reorderTask = useBoardStore(state => state.reorderTask);
  const readOnly = useBoardStore(state => state.readOnly);
  const openArchive = useBoardStore(state => state.openArchive);
  const visibleTasks = useMemo(
    () => getVisibleTasks(tasks, searchQuery),
    [tasks, searchQuery],
  );
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);
  const [previewPosition, setPreviewPosition] = useState<number>(-1);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const validStatuses = useMemo(
    () => new Set(config?.columns.map(column => column.id) ?? []),
    [config],
  );

  const columns = useMemo<Column[]>(
    () => (config ? buildColumns(config, visibleTasks, validStatuses) : []),
    [config, visibleTasks, validStatuses],
  );

  const activeTask = activeSlug
    ? (visibleTasks.find(task => task.slug === activeSlug) ?? null)
    : null;

  // A drop that resolves back to where the card already sits writes nothing
  // (see `resolveTaskDrop`), so it shows no indicator either — the line appears
  // exactly when releasing would actually move something.
  const originIndex = activeTask
    ? (columns
        .find(column => column.id === activeTask.frontmatter.status)
        ?.tasks.findIndex(task => task.slug === activeTask.slug) ?? -1)
    : -1;
  const isNoOpDrop =
    activeTask !== null &&
    previewStatus === activeTask.frontmatter.status &&
    previewPosition === originIndex;

  const clearPreview = () => {
    setActiveSlug(null);
    setPreviewStatus(null);
    setPreviewPosition(-1);
  };

  const onDragStart = (event: DragStartEvent) => {
    const slug = String(event.active.id);
    setActiveSlug(slug);
    // Highlight the source column from the start of the drag. If the source
    // is the Uncategorized column, leave previewStatus null — Uncategorized
    // never highlights since it isn't a valid drop target.
    const task = visibleTasks.find(t => t.slug === slug);
    if (task && validStatuses.has(task.frontmatter.status)) {
      setPreviewStatus(task.frontmatter.status);
    } else {
      setPreviewStatus(null);
    }
    // Seed the preview to the card's current index in its column. A drop that
    // never establishes a new target — pick-up-and-drop-in-place, or a return
    // to the origin slot — then resolves back to where it started instead of
    // collapsing to -1 (which would append to the bottom). onDragOver overrides
    // this as the pointer moves onto real targets.
    const sourceColumn = columns.find(
      column => column.id === task?.frontmatter.status,
    );
    setPreviewPosition(
      sourceColumn
        ? sourceColumn.tasks.findIndex(candidate => candidate.slug === slug)
        : -1,
    );
  };

  const onDragOver = (event: DragOverEvent) => {
    // No damping needed here any more: nothing this handler sets can move a
    // card, so `over` depends only on where the pointer is. See `buildColumns`.
    const preview = resolveDragOver({
      overId: event.over ? String(event.over.id) : null,
      overStatus: event.over?.data.current?.status as string | undefined,
      overIsColumn: event.over?.data.current?.isColumn === true,
      activeSlug,
      activeStatus: activeTask?.frontmatter.status,
      originIndex,
      columns,
    });

    setPreviewStatus(preview?.status ?? null);
    setPreviewPosition(preview?.position ?? -1);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const drop = resolveTaskDrop({
      activeSlug: activeId,
      activeStatus: activeTask?.frontmatter.status,
      overId: event.over ? String(event.over.id) : null,
      overStatus: event.over?.data.current?.status as string | undefined,
      overIsColumn: event.over?.data.current?.isColumn === true,
      previewStatus,
      previewPosition,
      columns,
    });

    clearPreview();

    if (!drop) return;
    void reorderTask(activeId, drop.status, drop.position);
  };

  if (!config) {
    return <BoardLoading />;
  }

  const isDragging = activeSlug !== null;

  if (searchQuery.trim() && visibleTasks.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-var(--sb-header-h)-2.5rem)] items-center justify-center">
        <div className="w-full max-w-md rounded-md border border-dashed border-sb-iron px-5 py-12 text-center">
          <RxMagnifyingGlass
            aria-hidden="true"
            className="mx-auto h-5 w-5 text-sb-silver"
          />
          <p className="mt-3 font-mono text-[13px] text-sb-frosted">
            No live tasks match “{searchQuery.trim()}”.
          </p>
          {readOnly ? null : (
            <>
              <p className="mt-2 text-[12px] text-sb-silver">
                Archived tasks aren’t searched.
              </p>
              <button
                className="mt-4 inline-flex h-9 items-center gap-2 rounded border border-sb-iron bg-transparent px-3 text-[13px] font-medium text-sb-frosted transition-colors hover:border-sb-silver hover:bg-sb-surface2"
                type="button"
                onClick={openArchive}
              >
                <RxArchive aria-hidden="true" className="h-3.5 w-3.5" />
                Search archive
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (readOnly) {
    return (
      <div className="flex min-h-[calc(100vh-var(--sb-header-h)-2.5rem)] gap-4 overflow-x-auto pb-4">
        {columns.map(column => (
          <StaticBoardColumn
            key={column.id}
            id={column.id}
            label={column.label}
            tasks={column.tasks}
            capMax={
              column.isDone && !searchQuery.trim()
                ? (config.done_display?.max ?? 0)
                : 0
            }
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      id="shipbench-board-dnd"
      collisionDetection={cardsOverColumns}
      sensors={sensors}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragCancel={clearPreview}
      onDragEnd={onDragEnd}
    >
      <div className="flex min-h-[calc(100vh-var(--sb-header-h)-2.5rem)] gap-4 overflow-x-auto pb-4">
        {columns.map(column => {
          const isUncategorized = column.id === UNCATEGORIZED_STATUS;
          return (
            <BoardColumn
              key={column.id}
              id={column.id}
              label={column.label}
              tasks={column.tasks}
              activeSlug={activeSlug}
              // The done column time-sorts, so a drop position there carries no
              // meaning — highlight the column but draw no insertion line.
              indicatorIndex={
                activeSlug &&
                !isNoOpDrop &&
                !isUncategorized &&
                !column.isDone &&
                previewStatus === column.id
                  ? indicatorIndexForColumn(
                      column.tasks,
                      activeSlug,
                      previewPosition,
                    )
                  : null
              }
              sortable={!isUncategorized && !column.isDone}
              isActive={!isUncategorized && previewStatus === column.id}
              isDisabledTarget={isUncategorized && isDragging}
              canCreate={!isUncategorized && !column.isDone}
              capMax={
                column.isDone && !searchQuery.trim()
                  ? (config.done_display?.max ?? 0)
                  : 0
              }
            />
          );
        })}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <TaskCard task={activeTask} status={activeTask.frontmatter.status} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function StaticBoardColumn({
  id,
  label,
  tasks,
  capMax,
}: {
  id: string;
  label: string;
  tasks: Task[];
  /** Cap on visible tasks. `0` or negative disables the cap. */
  capMax: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const cap = capMax > 0 ? capMax : Infinity;
  const capped = Number.isFinite(cap) && !expanded && tasks.length > cap;
  const visible = capped ? tasks.slice(0, cap) : tasks;
  const hidden = tasks.length - visible.length;

  const body =
    tasks.length > 0 ? (
      visible.map(task => (
        <TaskCard key={task.slug} task={task} status={id} draggable={false} />
      ))
    ) : (
      <ColumnEmptyPlaceholder />
    );

  return (
    <section className="flex w-[20rem] shrink-0 flex-col rounded-md border border-sb-iron transition-colors">
      <ColumnHeader label={label} count={tasks.length} />

      <div className="flex flex-1 flex-col gap-3 p-3">
        {body}
        {(hidden > 0 || (expanded && Number.isFinite(cap))) && (
          <CapToggle
            hidden={hidden}
            expanded={expanded}
            onToggle={() => setExpanded(v => !v)}
          />
        )}
      </div>
    </section>
  );
}

function CapToggle({
  hidden,
  expanded,
  onToggle,
}: {
  hidden: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-md border border-dashed border-sb-iron px-3 py-2 text-center font-mono text-[12px] text-sb-silver transition-colors hover:border-sb-silver hover:text-sb-frosted"
    >
      {expanded ? 'Show recent' : `Show ${hidden} more`}
    </button>
  );
}

function ColumnHeader({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-sb-iron px-3">
      <h2 className="flex min-w-0 items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 bg-sb-frosted"
          aria-hidden="true"
        />
        <span className="truncate font-mono text-[11px] uppercase tracking-[0.14em] text-sb-silver">
          {label}
        </span>
      </h2>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="rounded border border-sb-iron px-1.5 py-0.5 font-mono text-[11px] text-sb-silver">
          {count}
        </span>
        {children}
      </span>
    </div>
  );
}

function ColumnEmptyPlaceholder() {
  return (
    <div className="rounded-md border border-dashed border-sb-iron px-3 py-8 text-center font-mono text-[12px] text-sb-silver">
      Empty
    </div>
  );
}

/**
 * The drop position marker.
 *
 * Absolutely positioned inside the (relative) card wrapper and pulled into the
 * flex gap, so it adds no height and displaces nothing. That is what keeps the
 * drag preview non-reflexive — see `buildColumns`.
 */
function DropIndicator({ tail = false }: { tail?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-sb-frosted ${
        tail ? '-bottom-1.5' : '-top-1.5'
      }`}
    />
  );
}

function BoardColumn({
  id,
  label,
  tasks,
  activeSlug,
  indicatorIndex,
  sortable,
  isActive,
  isDisabledTarget,
  canCreate,
  capMax,
}: {
  id: string;
  label: string;
  tasks: Task[];
  activeSlug: string | null;
  /**
   * Index in `tasks` to draw the insertion line before; `tasks.length` draws it
   * after the last card. `null` draws nothing.
   */
  indicatorIndex: number | null;
  /** True for known non-done columns; false for Uncategorized and Done. */
  sortable: boolean;
  /** True when this column is the current drag target — shows accent border. */
  isActive: boolean;
  /** True when a drag is in progress AND this column cannot accept drops. */
  isDisabledTarget: boolean;
  /** True when this column is a valid target for newly-created tasks. */
  canCreate: boolean;
  /** Cap on visible tasks. `0` or negative disables the cap. */
  capMax: number;
}) {
  const { setNodeRef } = useDroppable({
    id: `column-${id}`,
    // `isColumn` is what the drop resolvers discriminate on. Matching the id
    // prefix instead would be ambiguous — a task titled "Column X" slugifies to
    // `column-x` and would be mistaken for a column droppable.
    data: { status: id, isColumn: true },
  });

  const [expanded, setExpanded] = useState(false);
  const cap = capMax > 0 ? capMax : Infinity;
  const capped = Number.isFinite(cap) && !expanded && tasks.length > cap;
  const visible = capped ? tasks.slice(0, cap) : tasks;
  const hidden = tasks.length - visible.length;

  // Clamp to what is actually rendered — the cap may hide the tail.
  const line =
    indicatorIndex === null ? null : Math.min(indicatorIndex, visible.length);

  const body =
    tasks.length > 0 ? (
      visible.map((task, index) => (
        <div key={task.slug} className="relative">
          {line === index ? <DropIndicator /> : null}
          <TaskCard
            task={task}
            status={id}
            draggable={sortable}
            isPlaceholder={activeSlug === task.slug}
          />
          {line === visible.length && index === visible.length - 1 ? (
            <DropIndicator tail />
          ) : null}
        </div>
      ))
    ) : canCreate ? (
      // `flex flex-col` so the button still stretches to the column width — as a
      // plain block child it would fall back to a button's shrink-to-fit width.
      <div className="relative flex flex-col">
        {line === null ? null : <DropIndicator />}
        <ColumnEmptyCreateTaskButton status={id} label={label} />
      </div>
    ) : (
      <ColumnEmptyPlaceholder />
    );

  const borderClass = isActive
    ? 'border-sb-silver'
    : isDisabledTarget
      ? 'border-dashed border-sb-iron'
      : 'border-sb-iron';

  return (
    <section
      className={`flex w-[20rem] shrink-0 flex-col rounded-md border transition-colors ${borderClass} ${
        isDisabledTarget ? 'pointer-events-none opacity-40' : ''
      }`}
      ref={setNodeRef}
    >
      <ColumnHeader label={label} count={tasks.length}>
        {canCreate ? (
          <ColumnCreateTaskIconButton status={id} label={label} />
        ) : null}
      </ColumnHeader>

      <div className="flex flex-1 flex-col gap-3 p-3">
        {sortable ? (
          <SortableContext
            items={visible.map(task => task.slug)}
            strategy={staticSortingStrategy}
          >
            {body}
          </SortableContext>
        ) : (
          body
        )}
        {(hidden > 0 || (expanded && Number.isFinite(cap))) && (
          <CapToggle
            hidden={hidden}
            expanded={expanded}
            onToggle={() => setExpanded(v => !v)}
          />
        )}
        {canCreate && tasks.length > 0 ? (
          <ColumnBottomCreateTaskButton status={id} label={label} />
        ) : null}
      </div>
    </section>
  );
}

function ColumnCreateTaskIconButton({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  return (
    <NewTaskDialog
      initialStatus={status}
      trigger={
        <button
          type="button"
          aria-label={`Add task to ${label}`}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-sb-silver transition-colors hover:bg-sb-surface2 hover:text-sb-frosted focus-visible:bg-sb-surface2 focus-visible:text-sb-frosted"
        >
          <RxPlus aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      }
    />
  );
}

function ColumnEmptyCreateTaskButton({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  return (
    <NewTaskDialog
      initialStatus={status}
      trigger={
        <button
          type="button"
          aria-label={`Add first task to ${label}`}
          className="group flex min-h-28 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-sb-iron px-3 py-8 text-center font-mono text-[12px] text-sb-silver transition-colors hover:border-sb-silver hover:bg-sb-surface hover:text-sb-frosted focus-visible:border-sb-silver focus-visible:bg-sb-surface focus-visible:text-sb-frosted"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded border border-sb-iron bg-sb-surface2 text-sb-silver transition-colors group-hover:text-sb-frosted">
            <RxPlus aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
          Add task
        </button>
      }
    />
  );
}

function ColumnBottomCreateTaskButton({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  return (
    <NewTaskDialog
      initialStatus={status}
      trigger={
        <button
          type="button"
          aria-label={`Add task to ${label} from column bottom`}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-sb-iron px-3 py-2 font-mono text-[12px] text-sb-silver transition-colors hover:border-sb-silver hover:text-sb-frosted focus-visible:border-sb-silver focus-visible:text-sb-frosted"
        >
          <RxPlus aria-hidden="true" className="h-3.5 w-3.5" />
          Add task
        </button>
      }
    />
  );
}

export interface TaskDropColumn {
  id: string;
  tasks: Task[];
}

/**
 * Decide what the drag preview should become for one hover, or `null` to show
 * no preview at all.
 *
 * Extracted from `onDragOver` because this decision table has now been the
 * source of two separate bugs and had no test around it.
 */
export function resolveDragOver({
  overId,
  overStatus,
  overIsColumn,
  activeSlug,
  activeStatus,
  originIndex,
  columns,
}: {
  overId: string | null;
  overStatus: string | undefined;
  /** True when `over` is a column's own droppable rather than a card. */
  overIsColumn: boolean;
  activeSlug: string | null;
  activeStatus: string | undefined;
  originIndex: number;
  columns: TaskDropColumn[];
}): { status: string; position: number } | null {
  // Off the board entirely — no target, and a drop here writes nothing.
  if (!overId) return null;

  // The dragged card stays rendered in its original slot (dimmed), so hovering
  // it is the user pointing at where the card came from — read it as "put it
  // back". Resolving to the origin makes the drop a no-op, which is the only
  // way to cancel a reorder without dragging clear off the board.
  //
  // This deliberately does not go through `getDragPreviewPosition`: that filters
  // the dragged card out of the candidates and would collapse to -1, appending
  // to the bottom. Holding the previous target here instead — the earlier
  // behaviour — stranded the card wherever it had last hovered.
  if (overId === activeSlug) {
    return activeStatus
      ? { status: activeStatus, position: originIndex }
      : null;
  }

  // Uncategorized isn't a valid drop target, so no column shows as active.
  if (!overStatus || overStatus === UNCATEGORIZED_STATUS) return null;

  // Genuine empty space in a column — an explicit "send to the tail". Thanks to
  // `cardsOverColumns` this now only happens when no card is under the pointer.
  if (overIsColumn) return { status: overStatus, position: -1 };

  const destination = columns.find(column => column.id === overStatus);
  if (!destination) return { status: overStatus, position: -1 };

  return {
    status: overStatus,
    position: getDragPreviewPosition({
      tasks: destination.tasks,
      overSlug: overId,
      activeSlug,
      sameColumn: activeStatus === overStatus,
    }),
  };
}

/**
 * Resolve where a drag should land, or `null` for a no-op drop.
 *
 * Extracted from `onDragEnd` so the branchy drop logic is unit-testable. The
 * load-bearing rule: a drop whose `over` is the dragged card itself (or its
 * projected placeholder) — or that has no `over` at all — carries no explicit
 * target, so we honor the standing preview position rather than recomputing it
 * (which would collapse to -1 via `getDragPreviewPosition` and append to the
 * bottom). When the result is the task's existing column + index, return `null`
 * so the caller skips the write entirely — an accidental pick-up-and-drop must
 * not reorder or bump `updated`.
 *
 * Note: -1 remains the "append to tail" sentinel, produced only by an explicit
 * empty-column-space drop here — never by a self/no-target drop.
 */
export function resolveTaskDrop({
  activeSlug,
  activeStatus,
  overId,
  overStatus,
  overIsColumn,
  previewStatus,
  previewPosition,
  columns,
}: {
  activeSlug: string;
  activeStatus: string | undefined;
  overId: string | null;
  overStatus: string | undefined;
  /** True when `over` is a column's own droppable rather than a card. */
  overIsColumn: boolean;
  previewStatus: string | null;
  previewPosition: number;
  columns: TaskDropColumn[];
}): { status: string; position: number } | null {
  const status =
    overStatus && overStatus !== UNCATEGORIZED_STATUS
      ? overStatus
      : previewStatus;
  if (!status) return null;

  let position = previewPosition;
  if (overId && overId !== activeSlug && !overIsColumn) {
    // Dropped on a real *other* card — insert at that card's index.
    const destination = columns.find(column => column.id === status);
    if (destination) {
      position = getDragPreviewPosition({
        tasks: destination.tasks,
        overSlug: overId,
        activeSlug,
        sameColumn: activeStatus === status,
      });
    }
  } else if (overIsColumn) {
    // Dropped on genuine empty column space — append to the tail.
    position = -1;
  }
  // else: self-drop or no target — keep the seeded / last-previewed position.

  // No-op: same column, same index it started from → skip the write.
  const originColumn = columns.find(column => column.id === activeStatus);
  const originIndex = originColumn
    ? originColumn.tasks.findIndex(candidate => candidate.slug === activeSlug)
    : -1;
  if (status === activeStatus && position === originIndex) return null;

  return { status, position };
}

export function getDragPreviewPosition({
  tasks,
  overSlug,
  activeSlug,
  sameColumn,
}: {
  tasks: Task[];
  overSlug: string;
  activeSlug: string | null;
  /**
   * True when the drag started in the same column being previewed. Enables
   * direction detection from index comparison — necessary because `DragOverlay`
   * suppresses the drag transform on the underlying active element, so we
   * cannot infer direction from rects at runtime.
   */
  sameColumn: boolean;
}): number {
  const candidates = tasks.filter(task => task.slug !== activeSlug);
  const overIndexInFiltered = candidates.findIndex(
    task => task.slug === overSlug,
  );
  if (overIndexInFiltered < 0) return -1;

  if (sameColumn && activeSlug) {
    const activeIndex = tasks.findIndex(task => task.slug === activeSlug);
    const overIndexInOriginal = tasks.findIndex(task => task.slug === overSlug);
    if (activeIndex >= 0 && overIndexInOriginal >= 0) {
      // Dragging down past the over target — insert AFTER it.
      // Dragging up onto the over target — insert BEFORE it.
      return activeIndex < overIndexInOriginal
        ? overIndexInFiltered + 1
        : overIndexInFiltered;
    }
  }

  // Cross-column: active isn't in `tasks`, so index comparison isn't
  // available. Default to inserting before the hovered card. Users who want
  // the tail can drop on the column's empty space (position = -1).
  return overIndexInFiltered;
}

function BoardLoading() {
  return (
    <div className="grid min-h-[70vh] place-items-center font-mono text-[12px] text-sb-silver">
      Loading board...
    </div>
  );
}
