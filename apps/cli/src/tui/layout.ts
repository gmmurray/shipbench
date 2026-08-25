/**
 * The degradation ladder — pure arithmetic over (terminal size, column count,
 * task counts). No strings, no escape sequences, no I/O. This is the module the
 * tests care about: every trigger point is a fixture in
 * layout.test.ts.
 */

import type { BoardModel, ColumnModel } from './model.js';

/**
 * Narrowest column that can still show a task. Below this a row is a word and a
 * half — a count is more honest, and a stacked section is more useful still.
 * Derived from the widest row prefix (2 cells) plus enough title to identify a
 * task (12 cells).
 */
export const MIN_COL_WIDTH = 14;

/**
 * Widest a column grows before the remainder is left unused. A 90-cell task row
 * is mostly whitespace; the doctrine's density target is a workbench, not a
 * billboard.
 */
export const MAX_COL_WIDTH = 48;

/** Below this, columns mode is impossible for any column count. */
export const MIN_STACKED_WIDTH = 20;

/** Status line (1) plus a section header and one task row. */
export const MIN_ROWS = 5;

/** Cells spent on padding inside each column's slot: one left, one right. */
const COL_PADDING = 2;

/**
 * Whether the priority meter earns its cells. Decided once per frame from the
 * *uniform* column width, never from a single column's width — otherwise the
 * spare cell handed to the leftmost columns below would give them a different
 * row format from their neighbours, which reads as a bug.
 *
 * The meter fits as soon as the title still clears the identify floor:
 * `MIN_COL_WIDTH + tiers + 1`. With the default three tiers that is 18.
 */
export function meterFitsIn(columnWidth: number, tiers: number): boolean {
  return columnWidth >= MIN_COL_WIDTH + tiers + 1;
}

/**
 * The width past which extra cells stop improving a row: the meter fits and the
 * title clears the identify floor. Kept as a named constant because the rejected
 * scoring rule in `planBoard` is stated in terms of it.
 */
export const COMFORT_COL_WIDTH = 18;

export type LadderRung =
  | 'columns'
  | 'columns-done-collapsed'
  | 'columns-empties-collapsed'
  | 'stacked'
  | 'too-small'
  | 'no-columns';

export interface ColumnsPlan {
  mode: 'columns';
  rung: Exclude<LadderRung, 'stacked' | 'too-small'>;
  columnWidth: number;
  /** Per-column widths. Equal to `columnWidth`, except the leftmost few which
   *  absorb the integer-division remainder so the board meets the right edge. */
  columnWidths: number[];
  rendered: ColumnModel[];
  collapsed: ColumnModel[];
  /** Task rows available to every rendered column. */
  bodyRows: number;
}

export interface StackedPlan {
  mode: 'stacked';
  rung: 'stacked';
  width: number;
  sections: { column: ColumnModel; rows: number }[];
  collapsed: ColumnModel[];
}

export interface TooSmallPlan {
  mode: 'too-small';
  rung: 'too-small';
}

/**
 * Not a rung — there is nothing to degrade. Distinct from `too-small` because
 * the two send an operator to different places: one to resize a window, the
 * other to fix what they typed.
 */
export interface NoColumnsPlan {
  mode: 'no-columns';
  rung: 'no-columns';
}

export type Plan = ColumnsPlan | StackedPlan | TooSmallPlan | NoColumnsPlan;

export interface Viewport {
  width: number;
  height: number;
}

/**
 * Width each column gets if `count` columns share `width`.
 *
 * Layout is `pad col pad │ pad col pad │ …` — one cell of padding on each side
 * of every column, single-cell rules between them.
 */
export function columnWidthFor(width: number, count: number): number {
  if (count <= 0) return 0;
  const chrome = count * COL_PADDING + (count - 1);
  return Math.floor((width - chrome) / count);
}

function fits(width: number, count: number): boolean {
  return count > 0 && columnWidthFor(width, count) >= MIN_COL_WIDTH;
}

/**
 * Water-filling: give every section an equal share, then hand surplus from
 * sections that need less to sections that need more, until nothing moves.
 * Column-agnostic and stable — the allocation depends only on counts, so it does
 * not flicker when a task moves between two columns of equal length.
 */
export function shareRows(needs: number[], available: number): number[] {
  const out = needs.map(() => 0);
  let remaining = available;
  let open = needs.map((_, index) => index);

  // Terminates without a guard: an index is only `open` while it still wants a
  // row, so once `share >= 1` every pass hands out at least `open.length` rows
  // and `remaining` strictly decreases toward the `share === 0` exit.
  while (remaining > 0 && open.length > 0) {
    const share = Math.floor(remaining / open.length);
    if (share === 0) break;
    const next: number[] = [];
    for (const index of open) {
      const want = needs[index] - out[index];
      const give = Math.min(share, want);
      out[index] += give;
      remaining -= give;
      if (out[index] < needs[index]) next.push(index);
    }
    open = next;
  }

  // Hand the integer-division remainder out one row at a time, longest queue
  // first, so a single spare row goes where it shows the most.
  open = open
    .filter(index => out[index] < needs[index])
    .sort((a, b) => needs[b] - needs[a]);
  for (const index of open) {
    if (remaining <= 0) break;
    out[index] += 1;
    remaining -= 1;
  }
  return out;
}

export function planBoard(model: BoardModel, viewport: Viewport): Plan {
  const { width, height } = viewport;
  const all = model.columns;

  // Checked before the size floor: a board with no columns stays unrenderable at
  // any width, and reporting it as a small terminal sends the operator to resize
  // a window over a mistyped `--status`.
  if (all.length === 0) return { mode: 'no-columns', rung: 'no-columns' };

  if (width < MIN_STACKED_WIDTH || height < MIN_ROWS) {
    return { mode: 'too-small', rung: 'too-small' };
  }

  // Rung W0 — everything rendered.
  const candidates: {
    rung: ColumnsPlan['rung'];
    rendered: ColumnModel[];
  }[] = [{ rung: 'columns', rendered: all }];

  // Rung W1 — the done column collapses to a count. It is the only column core
  // already treats as history, and the only one this module may name.
  const withoutDone = all.filter(column => !column.isDone);
  if (withoutDone.length < all.length && withoutDone.length > 0) {
    candidates.push({ rung: 'columns-done-collapsed', rendered: withoutDone });
  }

  // Rung W2 — empty columns collapse to a label and a zero. An uncategorized
  // column is never dropped this way; if it exists it has tasks by construction.
  const withoutEmpties = withoutDone.filter(column => column.tasks.length > 0);
  if (withoutEmpties.length < withoutDone.length && withoutEmpties.length > 0) {
    candidates.push({
      rung: 'columns-empties-collapsed',
      rendered: withoutEmpties,
    });
  }

  // First rung that fits, deliberately — not the "best" one.
  //
  // Scoring the arrangements was tried: maximise
  // `columns x min(columnWidth, COMFORT_COL_WIDTH)`. It fixes one visible wart
  // (at 84 cells this repo's five columns fit at exactly the 14-cell floor, while
  // at 83 the done column collapses and the survivors jump to 18 — the narrower
  // terminal renders the nicer board) and introduces a worse one: on a
  // twelve-column config the winner flips 12 / 11 / 12 / 11 columns at 203, 208,
  // 215 and 219 cells. Trading columns against width continuously oscillates
  // wherever the two are close.
  //
  // Taking rungs in order gives a property worth more than local optimality:
  // **widening the terminal never shows less.** A user has one width at a time, so
  // they never see the 83-vs-84 comparison; they do notice a column vanishing when
  // they drag the window wider.
  const chosen = candidates.find(candidate =>
    fits(width, candidate.rendered.length),
  );

  if (chosen) {
    const rendered = chosen.rendered;
    const collapsed = all.filter(column => !rendered.includes(column));
    // Status line (1) + inline column header (1).
    const bodyRows = height - 2;
    if (bodyRows < 1) return { mode: 'too-small', rung: 'too-small' };
    const fair = columnWidthFor(width, rendered.length);
    const columnWidth = Math.min(MAX_COL_WIDTH, fair);
    // Floor division leaves up to `count - 1` cells over. Hand them to the
    // leftmost columns so the board meets the right edge instead of fraying one
    // cell short. Suppressed once MAX_COL_WIDTH is binding — there the leftover
    // is deliberate.
    const spare =
      columnWidth === fair
        ? width -
          (columnWidth * rendered.length +
            rendered.length * COL_PADDING +
            (rendered.length - 1))
        : 0;
    return {
      mode: 'columns',
      rung: chosen.rung,
      columnWidth,
      columnWidths: rendered.map(
        (_, index) => columnWidth + (index < spare ? 1 : 0),
      ),
      rendered,
      collapsed,
      bodyRows,
    };
  }

  // Rung W3 — stacked. Reached only when no column arrangement clears the floor.
  // Done and empty columns stay collapsed: we are here because space is scarce,
  // and a stacked section that shows real titles beats four columns of nothing.
  const sectionColumns = all.filter(
    column => !column.isDone && column.tasks.length > 0,
  );
  const collapsed = all.filter(column => !sectionColumns.includes(column));
  if (sectionColumns.length === 0) {
    return {
      mode: 'stacked',
      rung: 'stacked',
      width,
      sections: [],
      collapsed,
    };
  }

  // Status line (1) + one header row per section.
  let usable = sectionColumns.slice();
  let available = height - 1 - usable.length;
  // A section that cannot show a single task row is worse than a footer chip, so
  // drop from the end of config order until each survivor can hold one row.
  while (usable.length > 1 && available < usable.length) {
    usable = usable.slice(0, -1);
    available = height - 1 - usable.length;
  }
  const dropped = sectionColumns.filter(column => !usable.includes(column));
  const rows = shareRows(
    usable.map(column => column.tasks.length),
    Math.max(0, available),
  );

  return {
    mode: 'stacked',
    rung: 'stacked',
    width,
    sections: usable.map((column, index) => ({ column, rows: rows[index] })),
    collapsed: [...collapsed, ...dropped],
  };
}
