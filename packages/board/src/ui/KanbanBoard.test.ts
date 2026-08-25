import type { ClientRect } from '@dnd-kit/core';
import type { ShipbenchConfig, Task } from '@shipbench/core';
import { describe, expect, it } from 'vitest';
import {
  buildColumns,
  cardsOverColumns,
  getDragPreviewPosition,
  indicatorIndexForColumn,
  resolveDragOver,
  resolveTaskDrop,
  type TaskDropColumn,
} from './KanbanBoard.js';

const task = (slug: string): Task => ({
  slug,
  frontmatter: {
    title: slug,
    status: 'todo',
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
  },
  body: '',
  comments: [],
});

describe('getDragPreviewPosition — same column', () => {
  const tasks = [task('a'), task('b'), task('c')];

  it('inserts AFTER the over target when dragging down (a → c)', () => {
    // The original bug: [a, b, c] drag a over c should produce [b, c, a],
    // which is insert-position 2 in the filtered [b, c].
    expect(
      getDragPreviewPosition({
        tasks,
        overSlug: 'c',
        activeSlug: 'a',
        sameColumn: true,
      }),
    ).toBe(2);
  });

  it('inserts BEFORE the over target when dragging up (c → a)', () => {
    // [a, b, c] drag c over a should produce [c, a, b], insert-position 0.
    expect(
      getDragPreviewPosition({
        tasks,
        overSlug: 'a',
        activeSlug: 'c',
        sameColumn: true,
      }),
    ).toBe(0);
  });

  it('handles adjacent downward drag (a → b)', () => {
    expect(
      getDragPreviewPosition({
        tasks,
        overSlug: 'b',
        activeSlug: 'a',
        sameColumn: true,
      }),
    ).toBe(1);
  });

  it('handles adjacent upward drag (c → b)', () => {
    expect(
      getDragPreviewPosition({
        tasks,
        overSlug: 'b',
        activeSlug: 'c',
        sameColumn: true,
      }),
    ).toBe(1);
  });

  it('handles middle-to-end drag (b → c)', () => {
    // [a, b, c] drag b over c → [a, c, b], insert-position 2 in filtered [a, c].
    expect(
      getDragPreviewPosition({
        tasks,
        overSlug: 'c',
        activeSlug: 'b',
        sameColumn: true,
      }),
    ).toBe(2);
  });

  it('returns -1 when the hover target is not in the column', () => {
    expect(
      getDragPreviewPosition({
        tasks,
        overSlug: 'missing',
        activeSlug: 'a',
        sameColumn: true,
      }),
    ).toBe(-1);
  });
});

describe('getDragPreviewPosition — cross column', () => {
  // Cross-column: the active card isn't in `tasks` (the destination column).
  const tasks = [task('x'), task('y'), task('z')];

  it('inserts BEFORE the hovered card when dragging in from another column', () => {
    expect(
      getDragPreviewPosition({
        tasks,
        overSlug: 'y',
        activeSlug: 'a',
        sameColumn: false,
      }),
    ).toBe(1);
  });

  it('returns -1 when the hover target is not in the destination', () => {
    expect(
      getDragPreviewPosition({
        tasks,
        overSlug: 'missing',
        activeSlug: 'a',
        sameColumn: false,
      }),
    ).toBe(-1);
  });
});

describe('resolveTaskDrop', () => {
  const columns: TaskDropColumn[] = [
    { id: 'todo', tasks: [task('a'), task('b'), task('c')] },
    { id: 'doing', tasks: [task('x'), task('y')] },
  ];

  it('is a no-op when a card is picked up and dropped in place (over self)', () => {
    // Repro 1: pointer never leaves the card, so `over` is the card itself and
    // the preview stayed seeded at its current index (0). Must not append.
    expect(
      resolveTaskDrop({
        activeSlug: 'a',
        activeStatus: 'todo',
        overId: 'a',
        overStatus: 'todo',
        overIsColumn: false,
        previewStatus: 'todo',
        previewPosition: 0,
        columns,
      }),
    ).toBeNull();
  });

  it('is a no-op when dropped with no `over` target at the origin index', () => {
    expect(
      resolveTaskDrop({
        activeSlug: 'b',
        activeStatus: 'todo',
        overId: null,
        overStatus: undefined,
        overIsColumn: false,
        previewStatus: 'todo',
        previewPosition: 1,
        columns,
      }),
    ).toBeNull();
  });

  it('honors a standing preview on a self-drop rather than recomputing', () => {
    // Contract: a drop whose `over` is the dragged card carries no explicit
    // target, so the standing preview wins — recomputing would collapse to -1
    // and append to the bottom. `c` started at index 2, so landing at 0 is a
    // real move and must be written.
    //
    // (In the UI, hovering your own card now resets the preview to the origin —
    // see `onDragOver` — so this input arrives as the no-op case above. The
    // contract is pinned here regardless, since `onDragEnd` trusts it.)
    expect(
      resolveTaskDrop({
        activeSlug: 'c',
        activeStatus: 'todo',
        overId: 'c',
        overStatus: 'todo',
        overIsColumn: false,
        previewStatus: 'todo',
        previewPosition: 0,
        columns,
      }),
    ).toEqual({ status: 'todo', position: 0 });
  });

  it('inserts at the hovered card index for a genuine reorder', () => {
    expect(
      resolveTaskDrop({
        activeSlug: 'a',
        activeStatus: 'todo',
        overId: 'c',
        overStatus: 'todo',
        overIsColumn: false,
        previewStatus: 'todo',
        previewPosition: 0,
        columns,
      }),
    ).toEqual({ status: 'todo', position: 2 });
  });

  it('appends (-1) when dropped on empty column space, even in the origin column', () => {
    // `a` is at index 0; a column-background drop is an explicit "send to tail".
    expect(
      resolveTaskDrop({
        activeSlug: 'a',
        activeStatus: 'todo',
        overId: 'column-todo',
        overStatus: 'todo',
        overIsColumn: true,
        previewStatus: 'todo',
        previewPosition: -1,
        columns,
      }),
    ).toEqual({ status: 'todo', position: -1 });
  });

  it('moves cross-column when dropped onto a card in another column', () => {
    expect(
      resolveTaskDrop({
        activeSlug: 'a',
        activeStatus: 'todo',
        overId: 'y',
        overStatus: 'doing',
        overIsColumn: false,
        previewStatus: 'doing',
        previewPosition: 1,
        columns,
      }),
    ).toEqual({ status: 'doing', position: 1 });
  });

  it('returns null when there is no resolvable status', () => {
    expect(
      resolveTaskDrop({
        activeSlug: 'a',
        activeStatus: 'todo',
        overId: null,
        overStatus: undefined,
        overIsColumn: false,
        previewStatus: null,
        previewPosition: -1,
        columns,
      }),
    ).toBeNull();
  });
});

describe('indicatorIndexForColumn', () => {
  const tasks = [task('a'), task('b'), task('c')];

  it('maps candidate positions straight through for a cross-column drag', () => {
    // The dragged card lives in another column, so no index shifting applies.
    expect(indicatorIndexForColumn(tasks, 'z', 0)).toBe(0);
    expect(indicatorIndexForColumn(tasks, 'z', 2)).toBe(2);
  });

  it('treats -1 as the tail', () => {
    expect(indicatorIndexForColumn(tasks, 'z', -1)).toBe(3);
    // Same column: the tail sits after the two candidates, stepping over the
    // dragged card that is still rendered in place.
    expect(indicatorIndexForColumn(tasks, 'a', -1)).toBe(3);
  });

  it('steps over the dragged card when it sits above the target', () => {
    // Dragging a (index 0) to sit after b: candidate position 1 is the gap
    // below b, which is rendered index 2.
    expect(indicatorIndexForColumn(tasks, 'a', 1)).toBe(2);
  });

  it('does not shift when the target is above the dragged card', () => {
    // Dragging c (index 2) up onto a: candidate position 0 is above a.
    expect(indicatorIndexForColumn(tasks, 'c', 0)).toBe(0);
  });

  it('clamps a position past the end to the tail', () => {
    expect(indicatorIndexForColumn(tasks, 'z', 99)).toBe(3);
  });
});

describe('buildColumns', () => {
  const config = {
    version: 1,
    name: 'P',
    columns: [
      { id: 'todo', label: 'To Do' },
      { id: 'done', label: 'Done' },
    ],
    default_column: 'todo',
    done_column: 'done',
    done_display: { max: 20 },
    priority: { values: ['low', 'medium', 'high'], default: 'medium' },
    schema: { custom_fields: {} },
    layout: { todo: ['b', 'a'] },
  } as ShipbenchConfig;
  const validStatuses = new Set(['todo', 'done']);

  it('orders each column and omits Uncategorized when every status is known', () => {
    const columns = buildColumns(config, [task('a'), task('b')], validStatuses);

    expect(columns.map(column => column.id)).toEqual(['todo', 'done']);
    expect(columns[0]?.tasks.map(t => t.slug)).toEqual(['b', 'a']);
    expect(columns[1]?.isDone).toBe(true);
  });

  it('appends an Uncategorized column for unknown statuses', () => {
    const orphan: Task = {
      ...task('orphan'),
      frontmatter: { ...task('orphan').frontmatter, status: 'mystery' },
    };
    const columns = buildColumns(config, [task('a'), orphan], validStatuses);

    expect(columns.at(-1)?.id).toBe('__uncategorized__');
    expect(columns.at(-1)?.tasks.map(t => t.slug)).toEqual(['orphan']);
  });
});

describe('resolveDragOver', () => {
  const columns: TaskDropColumn[] = [
    { id: 'todo', tasks: [task('x'), task('y'), task('z')] },
    { id: 'doing', tasks: [task('p'), task('q')] },
  ];
  // Dragging x, which sits at index 0 of todo.
  const dragging = {
    overIsColumn: false,
    activeSlug: 'x',
    activeStatus: 'todo',
    originIndex: 0,
    columns,
  };

  it('returns to the origin when hovering the dragged card itself', () => {
    // The reported bug: pick up x, drag to another column, come back to x's own
    // slot. This used to hold the stale target and strand the card at the tail,
    // making it impossible to put a card back without leaving the board.
    expect(
      resolveDragOver({ ...dragging, overId: 'x', overStatus: 'todo' }),
    ).toEqual({ status: 'todo', position: 0 });
  });

  it('returns to the origin from a mid-column card too', () => {
    // Pick up y (index 1), drag past z, come back onto y.
    expect(
      resolveDragOver({
        ...dragging,
        activeSlug: 'y',
        originIndex: 1,
        overId: 'y',
        overStatus: 'todo',
        overIsColumn: false,
      }),
    ).toEqual({ status: 'todo', position: 1 });
  });

  it('clears the preview when the pointer leaves the board', () => {
    expect(
      resolveDragOver({ ...dragging, overId: null, overStatus: undefined }),
    ).toBeNull();
  });

  it('clears the preview over the Uncategorized column', () => {
    expect(
      resolveDragOver({
        ...dragging,
        overId: 'column-__uncategorized__',
        overStatus: '__uncategorized__',
        overIsColumn: true,
      }),
    ).toBeNull();
  });

  it('sends to the tail when over column background', () => {
    expect(
      resolveDragOver({
        ...dragging,
        overId: 'column-doing',
        overStatus: 'doing',
        overIsColumn: true,
      }),
    ).toEqual({ status: 'doing', position: -1 });
  });

  it('inserts before the hovered card when crossing columns', () => {
    expect(
      resolveDragOver({ ...dragging, overId: 'q', overStatus: 'doing' }),
    ).toEqual({ status: 'doing', position: 1 });
  });

  it('uses direction-aware placement within the origin column', () => {
    // Dragging x down onto z inserts after it (candidate position 2 of [y, z]).
    expect(
      resolveDragOver({ ...dragging, overId: 'z', overStatus: 'todo' }),
    ).toEqual({ status: 'todo', position: 2 });
  });
});

describe('cardsOverColumns', () => {
  // Column body spans y=0..300 with three 60px cards separated by 12px gaps,
  // mirroring the `gap-3` / `p-3` layout.
  const rect = (top: number, height: number): ClientRect => ({
    top,
    left: 0,
    right: 320,
    bottom: top + height,
    width: 320,
    height,
  });

  const rects = new Map<string, ClientRect>([
    ['column-todo', rect(0, 300)],
    ['a', rect(12, 60)],
    ['b', rect(84, 60)],
    ['c', rect(156, 60)],
  ]);

  const containers = [
    {
      id: 'column-todo',
      data: { current: { status: 'todo', isColumn: true } },
    },
    { id: 'a', data: { current: { status: 'todo' } } },
    { id: 'b', data: { current: { status: 'todo' } } },
    { id: 'c', data: { current: { status: 'todo' } } },
  ];

  // dnd-kit's collision args are a large structural type; `cardsOverColumns`
  // only reads rects, container data, and the pointer, so the double supplies
  // exactly those and is cast at the boundary.
  const collide = (y: number) =>
    cardsOverColumns({
      collisionRect: rect(y, 1),
      droppableRects: rects,
      droppableContainers: containers,
      pointerCoordinates: { x: 100, y },
    } as unknown as Parameters<typeof cardsOverColumns>[0])[0]?.id;

  it('picks the card the pointer is directly on', () => {
    expect(collide(40)).toBe('a');
    expect(collide(110)).toBe('b');
  });

  it('assigns the gap between two cards to the card below it', () => {
    // y=78 is inside the 12px gap between a (ends 72) and b (starts 84).
    // Previously this hit the column and resolved to "send to tail".
    expect(collide(78)).toBe('b');
  });

  it('assigns the padding above the first card to that card', () => {
    expect(collide(4)).toBe('a');
  });

  it('falls through to the column below the last card', () => {
    // Genuinely empty space — the one place a tail drop is meant.
    expect(collide(260)).toBe('column-todo');
  });
});
