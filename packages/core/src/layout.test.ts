import { describe, expect, it } from 'vitest';
import {
  layoutAfterMove,
  layoutWithoutTask,
  orderedTasksForColumn,
} from './layout.js';
import type { Task } from './types.js';

function task(
  slug: string,
  status = 'todo',
  created = '2026-01-01',
  updated = created,
): Task {
  return {
    slug,
    frontmatter: {
      title: slug,
      status,
      created: `${created}T00:00:00.000Z`,
      updated: `${updated}T00:00:00.000Z`,
    },
    body: '',
    comments: [],
  };
}

describe('layoutWithoutTask', () => {
  it('drops the slug from every column', () => {
    expect(
      layoutWithoutTask({ todo: ['a', 'b'], doing: ['b', 'c'] }, 'b'),
    ).toEqual({ todo: ['a'], doing: ['c'] });
  });

  it('leaves other stale slugs alone when no existence set is given', () => {
    // Rollback paths rely on this: they are restoring state, not reconciling it.
    expect(layoutWithoutTask({ todo: ['ghost', 'a'] }, 'a')).toEqual({
      todo: ['ghost'],
    });
  });

  it('prunes slugs with no live task when given an existence set', () => {
    expect(
      layoutWithoutTask({ todo: ['ghost', 'a', 'b'] }, 'a', new Set(['b'])),
    ).toEqual({ todo: ['b'] });
  });
});

describe('layoutAfterMove', () => {
  const tasks = [
    task('a', 'todo', '2026-01-03'),
    task('b', 'todo', '2026-01-02'),
    task('c', 'todo', '2026-01-01'),
  ];

  it('inserts at the requested position', () => {
    expect(
      layoutAfterMove({
        layout: { todo: ['a', 'b', 'c'] },
        tasks,
        slug: 'c',
        toStatus: 'todo',
        position: 0,
        doneColumn: 'done',
      }),
    ).toEqual({ todo: ['c', 'a', 'b'] });
  });

  it('appends on -1', () => {
    expect(
      layoutAfterMove({
        layout: { todo: ['a', 'b', 'c'] },
        tasks,
        slug: 'a',
        toStatus: 'todo',
        position: -1,
        doneColumn: 'done',
      }),
    ).toEqual({ todo: ['b', 'c', 'a'] });
  });

  it('appends when the position is past the end', () => {
    expect(
      layoutAfterMove({
        layout: { todo: ['a', 'b', 'c'] },
        tasks,
        slug: 'a',
        toStatus: 'todo',
        position: 99,
        doneColumn: 'done',
      }),
    ).toEqual({ todo: ['b', 'c', 'a'] });
  });

  it('materializes unpositioned tasks by created desc before splicing', () => {
    // `position` is computed against the visible column — layout order then
    // leftovers by created desc. Without materializing them, an on-screen
    // position would land somewhere else entirely in the file.
    expect(
      layoutAfterMove({
        layout: {},
        tasks,
        slug: 'c',
        toStatus: 'todo',
        position: 1,
        doneColumn: 'done',
      }),
    ).toEqual({ todo: ['a', 'c', 'b'] });
  });

  it('records no manual order for the done column', () => {
    expect(
      layoutAfterMove({
        layout: { todo: ['a', 'b'], done: ['legacy'] },
        tasks,
        slug: 'a',
        toStatus: 'done',
        position: 0,
        doneColumn: 'done',
      }),
    ).toEqual({ todo: ['b'] });
  });

  it('strips a pre-existing done entry even when moving elsewhere', () => {
    expect(
      layoutAfterMove({
        layout: { todo: ['a'], done: ['legacy'] },
        tasks,
        slug: 'a',
        toStatus: 'doing',
        position: -1,
        doneColumn: 'done',
      }),
    ).toEqual({ todo: [], doing: ['a'] });
  });

  it('prunes slugs whose task no longer exists', () => {
    expect(
      layoutAfterMove({
        layout: { todo: ['ghost', 'a', 'b', 'c'] },
        tasks,
        slug: 'a',
        toStatus: 'todo',
        position: 0,
        doneColumn: 'done',
      }),
    ).toEqual({ todo: ['a', 'b', 'c'] });
  });

  it('moves a task across columns', () => {
    const crossTasks = [
      task('a', 'todo', '2026-01-02'),
      task('x', 'doing', '2026-01-01'),
    ];
    expect(
      layoutAfterMove({
        layout: { todo: ['a'], doing: ['x'] },
        tasks: crossTasks,
        slug: 'a',
        toStatus: 'doing',
        position: 0,
        doneColumn: 'done',
      }),
    ).toEqual({ todo: [], doing: ['a', 'x'] });
  });
});

describe('orderedTasksForColumn', () => {
  const validStatuses = new Set(['todo', 'done']);
  const a = task('a', 'todo', '2026-01-01');
  const b = task('b', 'todo', '2026-01-02');
  const c = task('c', 'todo', '2026-01-03');
  const orphan = task('orphan', 'mystery', '2026-01-05');
  const stale = task('stale', 'mystery', '2026-01-04');

  it('returns an empty list for an empty column', () => {
    expect(
      orderedTasksForColumn(
        [a],
        { todo: ['a'] },
        'done',
        validStatuses,
        'done',
      ),
    ).toEqual([]);
  });

  it('treats an explicit empty layout entry like an unpositioned column', () => {
    const out = orderedTasksForColumn(
      [a, b],
      { todo: [] },
      'todo',
      validStatuses,
      'done',
    );
    expect(out.map(t => t.slug)).toEqual(['b', 'a']);
  });

  it('applies the layout order and appends unlisted tasks by created desc', () => {
    const out = orderedTasksForColumn(
      [a, b, c],
      { todo: ['b', 'a'] },
      'todo',
      validStatuses,
      'done',
    );
    expect(out.map(t => t.slug)).toEqual(['b', 'a', 'c']);
  });

  it('ignores layout slugs that no longer correspond to a task', () => {
    const out = orderedTasksForColumn(
      [a, b],
      { todo: ['ghost', 'a', 'phantom', 'b'] },
      'todo',
      validStatuses,
      'done',
    );
    expect(out.map(t => t.slug)).toEqual(['a', 'b']);
  });

  it('renders the done column by updated desc, ignoring layout', () => {
    const older = task('older-done', 'done', '2026-01-10', '2026-02-01');
    const newer = task('newer-done', 'done', '2026-01-01', '2026-03-01');
    const out = orderedTasksForColumn(
      [older, newer],
      { done: ['older-done', 'newer-done'] },
      'done',
      validStatuses,
      'done',
    );
    expect(out.map(t => t.slug)).toEqual(['newer-done', 'older-done']);
  });

  it('renders uncategorized tasks by created desc, ignoring layout', () => {
    const out = orderedTasksForColumn(
      [a, b, orphan, stale],
      { todo: ['a', 'b'], mystery: ['stale', 'orphan'] },
      '__uncategorized__',
      validStatuses,
      'done',
    );
    expect(out.map(t => t.slug)).toEqual(['orphan', 'stale']);
  });
});

describe('layoutAfterMove ↔ orderedTasksForColumn agreement', () => {
  // The contract that binds the two: a position read off the rendered column
  // must land the task at that same index when the column is re-rendered from
  // the resulting layout. This is what used to be maintained by hand between
  // core and the Board store, and what drifted.
  const validStatuses = new Set(['todo', 'done']);
  const tasks = [
    task('a', 'todo', '2026-01-03'),
    task('b', 'todo', '2026-01-02'),
    task('c', 'todo', '2026-01-01'),
  ];

  for (const position of [0, 1, 2]) {
    it(`round-trips position ${position}`, () => {
      const layout = layoutAfterMove({
        layout: {},
        tasks,
        slug: 'c',
        toStatus: 'todo',
        position,
        doneColumn: 'done',
      });
      const rendered = orderedTasksForColumn(
        tasks,
        layout,
        'todo',
        validStatuses,
        'done',
      );
      expect(rendered.findIndex(t => t.slug === 'c')).toBe(position);
    });
  }
});
