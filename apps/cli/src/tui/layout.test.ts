/**
 * Assert the *ladder*, not the box drawing.
 *
 * Every trigger point quoted in docs/spikes/tui-board-visualizer.md is a case
 * here, so the document and the code cannot drift silently. Golden-file
 * assertions on whole frames are deliberately absent: they fail on every
 * cosmetic change and catch nothing the geometry invariants below miss.
 *
 * Nothing in this file touches a terminal, a PTY, or stdout.
 */

import {
  DEFAULT_CONFIG,
  type ShipbenchConfig,
  type Task,
} from '@shipbench/core';
import { describe, expect, it } from 'vitest';
import {
  columnWidthFor,
  MIN_COL_WIDTH,
  planBoard,
  shareRows,
} from './layout.js';
import { buildBoardModel } from './model.js';
import { renderBoard } from './render.js';
import { createStyler } from './style.js';
import { displayWidth, fit, truncate } from './text.js';

const style = createStyler({ color: false });

function task(
  slug: string,
  status: string,
  priority = 'medium',
  extra: Partial<Task['frontmatter']> = {},
): Task {
  return {
    slug,
    frontmatter: {
      title: `Task ${slug} with a title long enough to require truncation`,
      status,
      priority,
      created: '2026-06-01T00:00:00.000Z',
      updated: '2026-06-01T00:00:00.000Z',
      ...extra,
    },
    body: '',
    comments: [],
  };
}

function config(ids: string[], done = ids.at(-1)!): ShipbenchConfig {
  return {
    ...DEFAULT_CONFIG,
    name: 'test',
    columns: ids.map(id => ({ id, label: id })),
    default_column: ids[0],
    done_column: done,
    layout: {},
  };
}

function model(ids: string[], counts: Record<string, number>) {
  const cfg = config(ids);
  const tasks = Object.entries(counts).flatMap(([status, n]) =>
    Array.from({ length: n }, (_, i) => task(`${status}-${i}`, status)),
  );
  return { config: cfg, model: buildBoardModel(cfg, tasks, [], {}) };
}

describe('column width arithmetic', () => {
  it('accounts for one cell of padding per side and single-cell rules', () => {
    // 5 columns at 120: 120 - (5*2 padding) - (4 rules) = 106, /5 = 21.
    expect(columnWidthFor(120, 5)).toBe(21);
    expect(columnWidthFor(80, 5)).toBe(13);
    expect(columnWidthFor(80, 4)).toBe(17);
  });

  it('hands the integer-division remainder to the leftmost columns', () => {
    const board = model(['todo', 'done'], { todo: 1 });
    const plan = planBoard(board.model, { width: 33, height: 12 });
    expect(plan.mode).toBe('columns');
    if (plan.mode !== 'columns') return;
    // 33 - 4 padding - 1 rule = 28, /2 = 14 exactly, so nothing is spare.
    expect(plan.columnWidths).toEqual([14, 14]);

    const odd = planBoard(board.model, { width: 34, height: 12 });
    if (odd.mode !== 'columns') throw new Error('expected columns mode');
    expect(odd.columnWidths).toEqual([15, 14]);
  });
});

describe('degradation ladder', () => {
  const board = () =>
    model(['backlog', 'todo', 'in-progress', 'review', 'done'], {
      backlog: 17,
      todo: 3,
      'in-progress': 1,
      review: 1,
      done: 71,
    });

  it('renders every column while each clears the floor', () => {
    const plan = planBoard(board().model, { width: 120, height: 34 });
    expect(plan.rung).toBe('columns');
  });

  it('collapses the done column at the first width that cannot fit five', () => {
    // 84 is the narrowest width where five columns clear MIN_COL_WIDTH.
    expect(planBoard(board().model, { width: 84, height: 34 }).rung).toBe(
      'columns',
    );
    expect(planBoard(board().model, { width: 83, height: 34 }).rung).toBe(
      'columns-done-collapsed',
    );
  });

  it('falls to stacked sections rather than sub-floor columns', () => {
    expect(planBoard(board().model, { width: 67, height: 34 }).rung).toBe(
      'columns-done-collapsed',
    );
    expect(planBoard(board().model, { width: 66, height: 34 }).rung).toBe(
      'stacked',
    );
  });

  it('collapses empty columns before abandoning columns mode', () => {
    const twelve = model(
      Array.from({ length: 12 }, (_, i) => `c${i}`),
      { c0: 6, c1: 3, c2: 2, c5: 2, c6: 1, c7: 2, c10: 9 },
    );
    expect(planBoard(twelve.model, { width: 203, height: 30 }).rung).toBe(
      'columns',
    );
    expect(planBoard(twelve.model, { width: 202, height: 30 }).rung).toBe(
      'columns-done-collapsed',
    );
    expect(planBoard(twelve.model, { width: 185, height: 30 }).rung).toBe(
      'columns-empties-collapsed',
    );
    expect(planBoard(twelve.model, { width: 117, height: 30 }).rung).toBe(
      'stacked',
    );
  });

  it('never shows fewer columns as the terminal widens', () => {
    // The property the rejected scoring rule would have broken: rungs taken in
    // order guarantee monotonicity, which is what a user dragging a window can
    // actually perceive.
    const twelve = model(
      Array.from({ length: 12 }, (_, i) => `c${i}`),
      { c0: 6, c1: 3, c2: 2, c5: 2, c6: 1, c7: 2, c10: 9 },
    );
    let previous = 0;
    for (let width = 20; width <= 240; width += 1) {
      const plan = planBoard(twelve.model, { width, height: 30 });
      const shown = plan.mode === 'columns' ? plan.rendered.length : 0;
      if (plan.mode === 'columns') {
        expect(shown).toBeGreaterThanOrEqual(previous);
        previous = shown;
      }
    }
  });

  it('reports too-small below the floor in either dimension', () => {
    expect(planBoard(board().model, { width: 19, height: 30 }).rung).toBe(
      'too-small',
    );
    expect(planBoard(board().model, { width: 120, height: 4 }).rung).toBe(
      'too-small',
    );
  });
});

describe('nothing to render', () => {
  const cfg = config(['todo', 'done']);

  it('distinguishes an unmatched --status from a small terminal', () => {
    const built = buildBoardModel(cfg, [task('a', 'todo')], [], {
      statuses: ['nope'],
    });
    // Reported before the size floor: no width makes an empty board renderable,
    // and "too small" would send the operator to resize a window over a typo.
    expect(planBoard(built, { width: 200, height: 50 }).rung).toBe(
      'no-columns',
    );
    expect(planBoard(built, { width: 10, height: 3 }).rung).toBe('no-columns');
    expect(
      renderBoard(built, { width: 80, height: 24 }, { style, config: cfg }),
    ).toEqual(['shipbench: no column matches --status=nope']);
  });

  it('names every --status value that missed, and only those', () => {
    const built = buildBoardModel(cfg, [task('a', 'todo')], [], {
      statuses: ['nope', 'todo', 'gone'],
    });
    expect(built.unknownStatuses).toEqual(['nope', 'gone']);
    // A partial match still renders the columns that resolved.
    expect(planBoard(built, { width: 80, height: 24 }).rung).toBe('columns');
  });

  it('reports a config with no columns as a config problem', () => {
    // `loadConfig` accepts `{"columns": []}` today; the renderer should say what
    // is actually wrong rather than blaming the window.
    const empty = buildBoardModel({ ...cfg, columns: [] }, [], [], {});
    expect(
      renderBoard(empty, { width: 80, height: 24 }, { style, config: cfg }),
    ).toEqual(['shipbench: no columns configured in .shipbench/config.json']);
  });

  it('still surfaces uncategorized tasks when no configured column matches', () => {
    // The uncategorized column is never gated behind --status, so this is a real
    // board, not the no-columns case.
    const built = buildBoardModel(cfg, [task('b', 'retired')], [], {
      statuses: ['nope'],
    });
    expect(planBoard(built, { width: 80, height: 24 }).rung).toBe('columns');
  });
});

describe('column agnosticism', () => {
  it('drives the ladder from config alone, with no id spelled out', () => {
    const two = model(['open', 'shipped'], { open: 3, shipped: 2 });
    expect(planBoard(two.model, { width: 33, height: 30 }).rung).toBe(
      'columns',
    );
    // `shipped` is this project's done column, and it is the one that collapses.
    const narrow = planBoard(two.model, { width: 32, height: 30 });
    expect(narrow.rung).toBe('columns-done-collapsed');
    if (narrow.mode !== 'columns') throw new Error('expected columns mode');
    expect(narrow.collapsed.map(column => column.id)).toEqual(['shipped']);
  });

  it('time-sorts and caps the done column whatever it is named', () => {
    const cfg = config(['open', 'shipped']);
    const done = Array.from({ length: 25 }, (_, i) => ({
      ...task(`s${i}`, 'shipped'),
      frontmatter: {
        ...task(`s${i}`, 'shipped').frontmatter,
        updated: `2026-06-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
      },
    }));
    const built = buildBoardModel(cfg, done, [], {});
    const column = built.columns.find(c => c.id === 'shipped');
    // done_display.max defaults to 20; the newest task leads.
    expect(column?.tasks).toHaveLength(20);
    expect(column?.cappedOut).toBe(5);
    expect(column?.tasks[0]?.slug).toBe('s24');
  });
});

describe('invalid statuses', () => {
  const cfg = config(['todo', 'done']);
  const built = () =>
    buildBoardModel(
      cfg,
      [task('a', 'todo'), task('b', 'retired-column')],
      [{ slug: 'b', field: 'status', message: 'Invalid status' }],
      {},
    );

  it('surfaces tasks whose status matches no column', () => {
    expect(built().uncategorizedCount).toBe(1);
    const uncategorized = built().columns.find(c => c.isUncategorized);
    expect(uncategorized?.tasks.map(t => t.slug)).toEqual(['b']);
  });

  it('exempts the uncategorized column from every collapse rung', () => {
    // `done` is empty here, so W1 and W2 both have something to give up first.
    const plan = planBoard(built(), { width: 40, height: 20 });
    if (plan.mode !== 'columns') throw new Error('expected columns mode');
    expect(plan.rendered.some(column => column.isUncategorized)).toBe(true);
    expect(plan.collapsed.some(column => column.isUncategorized)).toBe(false);
  });

  it('never gates the uncategorized column behind --status', () => {
    const filtered = buildBoardModel(
      cfg,
      [task('a', 'todo'), task('b', 'retired-column')],
      [],
      { statuses: ['todo'] },
    );
    expect(filtered.columns.map(c => c.id)).toEqual([
      'todo',
      '__uncategorized__',
    ]);
  });
});

describe('task filters', () => {
  const cfg = config(['todo', 'done']);
  const tasks = [
    task('a', 'todo', 'medium', { tags: ['cli'] }),
    task('b', 'todo', 'medium', { tags: ['site'] }),
    ...Array.from({ length: 25 }, (_, i) =>
      task(`d${i}`, 'done', 'medium', { tags: i === 0 ? ['cli'] : ['site'] }),
    ),
  ];

  it('reports shown/total once a task filter is active', () => {
    const built = buildBoardModel(cfg, tasks, [], { tags: ['cli'] });
    expect(built.filtered).toBe(true);
    const todo = built.columns.find(c => c.id === 'todo');
    expect(todo?.tasks).toHaveLength(1);
    expect(todo?.total).toBe(2);
    const frame = renderBoard(
      built,
      { width: 100, height: 10 },
      { style, config: cfg },
    ).join('\n');
    expect(frame).toContain('1/2');
  });

  it('applies the done cap after filtering, not before', () => {
    // Capping first reported "+51 more" on this board's done column where the
    // hidden tasks had never been checked against the tag. One done task carries
    // the tag, so nothing is hidden and no footer appears.
    const built = buildBoardModel(cfg, tasks, [], { tags: ['cli'] });
    const done = built.columns.find(c => c.id === 'done');
    expect(done?.tasks).toHaveLength(1);
    expect(done?.cappedOut).toBe(0);
  });

  it('distinguishes a filtered-empty column from an empty one', () => {
    const filtered = buildBoardModel(cfg, tasks, [], { tags: ['nothing'] });
    expect(
      renderBoard(
        filtered,
        { width: 100, height: 10 },
        { style, config: cfg },
      ).join('\n'),
    ).toContain('no match');

    const empty = buildBoardModel(cfg, [], [], {});
    expect(
      renderBoard(
        empty,
        { width: 100, height: 10 },
        { style, config: cfg },
      ).join('\n'),
    ).toContain('empty');
  });
});

describe('vertical overflow', () => {
  it('surrenders one row to the hidden count', () => {
    const tall = model(['todo', 'done'], { todo: 40 });
    const lines = renderBoard(
      tall.model,
      { width: 100, height: 12 },
      { style, config: tall.config },
    );
    // height - 2 = 10 body rows: 9 tasks plus the footer.
    expect(lines.join('\n')).toContain('+31 more');
  });

  it('shares rows between stacked sections by need', () => {
    expect(shareRows([6, 3, 2], 11)).toEqual([6, 3, 2]);
    expect(shareRows([6, 3, 2], 6)).toEqual([2, 2, 2]);
    expect(shareRows([10, 1, 1], 6)).toEqual([4, 1, 1]);
  });

  it('spends a section’s only row on a task, never on a footer', () => {
    const twelve = model(
      Array.from({ length: 12 }, (_, i) => `c${i}`),
      { c0: 6, c1: 3, c2: 2, c5: 2, c6: 1, c7: 2, c10: 9 },
    );
    const plan = planBoard(twelve.model, { width: 117, height: 14 });
    if (plan.mode !== 'stacked') throw new Error('expected stacked mode');
    const single = plan.sections.filter(section => section.rows === 1);
    expect(single.length).toBeGreaterThan(0);

    const frame = renderBoard(
      twelve.model,
      { width: 117, height: 14 },
      { style, config: twelve.config },
    );
    for (const section of single) {
      const header = frame.findIndex(line =>
        line.startsWith(`${section.column.label.toUpperCase()} `),
      );
      // The header count already carries the hidden total, so the row below it
      // is a task. A section that spends its only row on `+N more` shows nothing.
      expect(header).toBeGreaterThanOrEqual(0);
      expect(frame[header + 1].startsWith('+')).toBe(false);
    }
  });
});

describe('frame geometry', () => {
  const board = model(['backlog', 'todo', 'in-progress', 'review', 'done'], {
    backlog: 17,
    todo: 3,
    'in-progress': 1,
    review: 1,
    done: 30,
  });

  it('never emits a line wider than the viewport', () => {
    for (const width of [20, 40, 60, 66, 67, 80, 83, 84, 100, 120, 200]) {
      const lines = renderBoard(
        board.model,
        { width, height: 30 },
        { style, config: board.config },
      );
      for (const line of lines) {
        expect(displayWidth(line)).toBeLessThanOrEqual(width);
      }
    }
  });

  it('fills exactly one screen of rows', () => {
    const two = model(['todo', 'done'], { todo: 2 });
    for (const height of [6, 12, 30, 60]) {
      const lines = renderBoard(
        two.model,
        { width: 100, height },
        { style, config: two.config },
      );
      expect(lines).toHaveLength(height);
    }
  });

  it('renders one line below the floor', () => {
    expect(
      renderBoard(
        board.model,
        { width: 60, height: 4 },
        { style, config: board.config },
      ),
    ).toEqual(['shipbench: terminal too small']);
    expect(
      renderBoard(
        board.model,
        { width: 18, height: 10 },
        { style, config: board.config },
      ),
    ).toEqual(['shipbench: termin…']);
  });
});

describe('meter legibility without colour', () => {
  it('distinguishes tiers by character, not only by attribute', () => {
    const cfg = config(['todo', 'done']);
    const built = buildBoardModel(
      cfg,
      [
        task('high', 'todo', 'high'),
        task('medium', 'todo', 'medium'),
        task('low', 'todo', 'low'),
      ],
      [],
      {},
    );
    const plain = renderBoard(
      built,
      { width: 100, height: 10 },
      { style, config: cfg },
    ).join('\n');
    expect(plain).toContain('›››');
    expect(plain).toContain('››·');
    expect(plain).toContain('›··');
  });

  it('drops the meter below the width where the title still identifies a task', () => {
    const board = model(['todo', 'done'], { todo: 3 });
    // 18 = MIN_COL_WIDTH + 3 tiers + 1 separating space.
    const wide = renderBoard(
      board.model,
      { width: 41, height: 10 },
      { style, config: board.config },
    ).join('\n');
    const narrow = renderBoard(
      board.model,
      { width: 39, height: 10 },
      { style, config: board.config },
    ).join('\n');
    expect(wide).toContain('››·');
    expect(narrow).not.toContain('››·');
  });

  it('keeps low-priority titles plain while retaining bold for high priority', () => {
    const cfg = config(['todo', 'done']);
    const built = buildBoardModel(
      cfg,
      [task('high', 'todo', 'high'), task('low', 'todo', 'low')],
      [],
      {},
    );
    const coloured = renderBoard(
      built,
      { width: 100, height: 10 },
      { style: createStyler({ color: true }), config: cfg },
    ).join('\n');

    expect(coloured).toContain('\x1b[1mTask high');
    expect(coloured).not.toContain('\x1b[2mTask low');
  });
});

describe('waiting task markers', () => {
  const cfg = config(['todo', 'done']);
  const foundation = task('foundation', 'todo');
  const archivedFoundation = task('archived-foundation', 'done');
  const blocked = task('blocked', 'todo', 'medium', {
    depends_on: ['foundation'],
  });
  const archiveSatisfied = task('archive-satisfied', 'todo', 'medium', {
    depends_on: ['archived-foundation'],
  });
  const built = buildBoardModel(
    cfg,
    [foundation, blocked, archiveSatisfied],
    [],
    {},
    [archivedFoundation],
  );

  it('uses core dependency resolution, including archived dependencies', () => {
    expect([...built.blockedTaskSlugs]).toEqual(['blocked']);
  });

  it('replaces the meter separator so the marker costs no extra cells', () => {
    const plain = renderBoard(
      built,
      { width: 100, height: 10 },
      { style, config: cfg },
    ).join('\n');

    expect(plain).toContain('››·~Task blocked');
    expect(plain).toContain('››· Task archive-satisfied');
  });

  it('keeps a literal marker when NO_COLOR hides every attribute', () => {
    const plain = renderBoard(
      built,
      { width: 39, height: 10 },
      { style, config: cfg },
    ).join('\n');

    expect(plain).toContain('~Task blocked');
  });

  it('dims the marker without borrowing the warning colour', () => {
    const coloured = renderBoard(
      built,
      { width: 100, height: 10 },
      { style: createStyler({ color: true }), config: cfg },
    ).join('\n');

    expect(coloured).toContain('\x1b[2m~\x1b[0mTask blocked');
    expect(coloured).not.toContain('\x1b[33m~');
  });

  it('shows one waiting key only while a marked task is visible', () => {
    const visible = renderBoard(
      built,
      { width: 100, height: 10 },
      { style, config: cfg },
    );
    expect(visible.at(-1)).toContain('test  ~ = waiting');

    const quiet = buildBoardModel(cfg, [foundation, archiveSatisfied], [], {}, [
      archivedFoundation,
    ]);
    expect(
      renderBoard(quiet, { width: 100, height: 10 }, { style, config: cfg }).at(
        -1,
      ),
    ).not.toContain('~ = waiting');

    const hiddenCfg = {
      ...cfg,
      layout: {
        todo: ['foundation', 'archive-satisfied', 'extra', 'blocked'],
      },
    };
    const hidden = buildBoardModel(
      hiddenCfg,
      [foundation, archiveSatisfied, task('extra', 'todo'), blocked],
      [],
      {},
      [archivedFoundation],
    );
    const hiddenFrame = renderBoard(
      hidden,
      { width: 100, height: 5 },
      { style, config: hiddenCfg },
    );
    expect(hiddenFrame.join('\n')).not.toContain('~Task blocked');
    expect(hiddenFrame.at(-1)).not.toContain('~ = waiting');
  });

  it('drops the key before the project name when the status line is narrow', () => {
    const narrow = renderBoard(
      built,
      { width: 20, height: 10 },
      { style, config: cfg },
    );

    expect(narrow.join('\n')).toContain('~Task blocked');
    expect(narrow.at(-1)).toContain('test');
    expect(narrow.at(-1)).not.toContain('~ = waiting');
  });
});

describe('status line timestamp', () => {
  it('labels the last successful read at absolute minute precision', () => {
    const cfg = config(['todo', 'done']);
    const built = buildBoardModel(
      cfg,
      [task('one', 'todo')],
      [],
      {},
      [],
      [],
      new Date(2026, 5, 1, 14, 32, 7),
    );
    const status = renderBoard(
      built,
      { width: 100, height: 10 },
      { style, config: cfg },
    ).at(-1);

    expect(status).toContain('updated 14:32');
    expect(status).not.toContain('14:32:07');
  });
});

describe('display width', () => {
  // The width table is hand-rolled rather than delegated to
  // `get-east-asian-width`, which keeps the zero-added-packages claim literally
  // true of the shipped CLI. These are the cases that buys.
  it('counts the renderer’s own glyphs as one cell each', () => {
    for (const glyph of ['─', '│', '›', '·', '~', '…']) {
      expect(displayWidth(glyph)).toBe(1);
    }
  });

  it('counts East Asian wide characters as two cells', () => {
    expect(displayWidth('日本語')).toBe(6);
    expect(displayWidth('가나')).toBe(4);
  });

  it('counts combining marks and zero-width joiners as none', () => {
    expect(displayWidth('é')).toBe(1);
    expect(displayWidth('a​b')).toBe(2);
  });

  it('counts astral-plane symbols as two, so a stray one shrinks a column', () => {
    expect(displayWidth('\u{1f680}')).toBe(2);
  });
});

describe('truncation', () => {
  it('leaves text that already fits alone', () => {
    expect(truncate('short', 10)).toBe('short');
    expect(truncate('exactly-10', 10)).toBe('exactly-10');
  });

  it('cuts at the end and spends one cell on the ellipsis', () => {
    expect(truncate('alpha beta', 8)).toBe('alpha b…');
    expect(displayWidth(truncate('alpha beta', 8))).toBe(8);
  });

  it('trims trailing separators so a cut never reads as "word ..."', () => {
    expect(truncate('alpha (beta)', 8)).toBe('alpha…');
    expect(truncate('alpha, beta', 8)).toBe('alpha…');
    expect(truncate('alpha - beta', 9)).toBe('alpha…');
  });

  it('degenerates sanely at the smallest limits', () => {
    expect(truncate('abcdef', 1)).toBe('…');
    expect(truncate('abcdef', 0)).toBe('');
  });

  it('pads to exactly the requested width', () => {
    expect(fit('ab', 5)).toBe('ab   ');
    expect(displayWidth(fit('日本語', 5))).toBe(5);
  });
});

describe('MIN_COL_WIDTH is the documented floor', () => {
  it('matches the value the spec quotes', () => {
    expect(MIN_COL_WIDTH).toBe(14);
  });
});
