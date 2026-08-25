/**
 * The renderer. `renderBoard` is pure: model + viewport in, array of terminal
 * lines out. Nothing here touches process.stdout, so every layout is a unit test at a fixed width.
 */

import type { ShipbenchConfig, Task } from '@shipbench/core';
import { meterFitsIn, type Plan, planBoard, type Viewport } from './layout.js';
import { type BoardModel, type ColumnModel, priorityRank } from './model.js';
import { BOX, type StyleName, type Styler, stripSgr } from './style.js';
import { displayWidth, fit, truncate } from './text.js';

export interface RenderOptions {
  style: Styler;
  config: ShipbenchConfig;
}

/** Content rungs, decided once per frame. See `meterFitsIn`. */
interface RowFormat {
  meter: boolean;
}

/**
 * Doctrine translation. The doctrine's priority meter is a chevron gauge with a
 * perceptible track; the terminal version is the same gauge with `›`, filled
 * chevrons at normal weight and the track dim. Priority stays neutral — no hue.
 */
function meter(task: Task, config: ShipbenchConfig, style: Styler): string {
  const tiers = config.priority.values.length;
  const rank = priorityRank(task, config);
  const filled = rank < 0 ? 0 : rank + 1;
  return (
    BOX.chevron.repeat(filled) +
    style(BOX.track.repeat(Math.max(0, tiers - filled)), 'dim')
  );
}

/**
 * Priority also rides the title's weight, which costs no cells at all: the top
 * tier is bold and every other tier is plain. When a column is too narrow for
 * the meter this deliberately leaves low and medium indistinguishable. Title
 * legibility matters more than preserving that fine distinction, and `dim` is
 * reserved for structural information that should recede.
 */
function titleWeight(task: Task, config: ShipbenchConfig): 'bold' | undefined {
  const rank = priorityRank(task, config);
  const top = config.priority.values.length - 1;
  if (rank < 0) return undefined;
  if (rank === top && top > 0) return 'bold';
  return undefined;
}

function taskRow(
  task: Task,
  blocked: boolean,
  width: number,
  format: RowFormat,
  options: RenderOptions,
): string {
  const { style, config } = options;
  const weight = titleWeight(task, config);
  // With a meter, the marker replaces its separator: `››·~Title` costs exactly
  // the same cells as `››· Title`. Below the meter threshold it takes the first
  // title cell. Either way the row keeps its width and `~` survives NO_COLOR.
  // This deliberately does not borrow the warning glyph or colour: an unfinished
  // dependency is healthy planned order, not something wrong. Dim means exactly
  // what this state needs to say — recede, not now.
  const marker = blocked ? style(BOX.waiting, 'dim') : '';
  const prefixWidth = format.meter
    ? config.priority.values.length + 1
    : blocked
      ? 1
      : 0;
  const title = truncate(
    task.frontmatter.title,
    Math.max(0, width - prefixWidth),
  );
  const styledTitle = weight ? style(title, weight) : title;
  const gap = Math.max(0, width - prefixWidth - displayWidth(title));

  return (
    (format.meter
      ? `${meter(task, config, style)}${blocked ? marker : ' '}`
      : marker) +
    styledTitle +
    ' '.repeat(gap)
  );
}

function countLabel(column: ColumnModel, filtered: boolean): string {
  if (filtered && column.tasks.length !== column.total) {
    return `${column.tasks.length}/${column.total}`;
  }
  return String(column.total);
}

/**
 * The doctrine's section-header primitive — uppercase label, a hairline rule
 * filling the gap, then the count — collapsed onto one row.
 *
 * The obvious alternative is label-on-one-row plus a full-width underline on the
 * next, which is what the first prototype did. It costs one row *per frame*, and
 * a row is a task; the inline form separates header from body just as clearly and
 * happens to be the shape the doctrine already specifies.
 */
function sectionHeader(
  column: ColumnModel,
  width: number,
  model: BoardModel,
  options: RenderOptions,
): string {
  const { style } = options;
  const label = column.label.toUpperCase();
  const count = countLabel(column, model.filtered);
  const attrs: StyleName[] = column.isUncategorized
    ? ['yellow', 'bold']
    : column.isDone
      ? ['dim']
      : ['bold'];

  const labelCut = truncate(
    label,
    Math.max(0, width - displayWidth(count) - 2),
  );
  const ruleWidth =
    width - displayWidth(labelCut) - displayWidth(count) - (labelCut ? 2 : 0);
  if (ruleWidth < 0) return fit(count, width);
  return (
    style(labelCut, ...attrs) +
    (labelCut ? ' ' : '') +
    style(BOX.rule.repeat(ruleWidth), 'dim') +
    (labelCut ? ' ' : '') +
    style(count, 'dim')
  );
}

function columnBody(
  column: ColumnModel,
  width: number,
  rows: number,
  model: BoardModel,
  format: RowFormat,
  options: RenderOptions,
): string[] {
  const { style } = options;
  if (column.tasks.length === 0) {
    // A filtered-empty column is a different fact from an empty one, and the
    // board's shape is what you came for — neither is ever hidden.
    const message = model.filtered && column.total > 0 ? 'no match' : 'empty';
    return [style(fit(message, width), 'dim')];
  }
  const row = (task: Task) =>
    taskRow(
      task,
      model.blockedTaskSlugs.has(task.slug),
      width,
      format,
      options,
    );
  const visible = visibleTasks(column, rows);
  // `cappedOut` is what `done_display.max` already withheld. It reads as hidden
  // rows exactly like viewport truncation does, so the two share one footer
  // rather than inventing a second vocabulary for the same fact.
  if (column.cappedOut === 0 && column.tasks.length <= rows) {
    return visible.map(row);
  }
  // With a single row to spend, spend it on a task. The footer costs the same row
  // and says less than the count already in the header — a stacked board at 117x14
  // rendered `+5 more` beneath a heading reading `INTAKE 6` and showed no task at
  // all, which is worse than useless.
  if (rows <= 1) return visible.map(row);
  // Otherwise one row is surrendered to the footer, so the hidden count is never
  // itself hidden — the alternative is a column that lies about its length.
  const shown = visible.length;
  const hidden = column.tasks.length - shown + column.cappedOut;
  return [...visible.map(row), style(fit(`+${hidden} more`, width), 'dim')];
}

/** The exact task slice `columnBody` puts on screen before any `+N more` row. */
function visibleTasks(column: ColumnModel, rows: number): Task[] {
  if (rows <= 0 || column.tasks.length === 0) return [];
  if (column.cappedOut === 0 && column.tasks.length <= rows) {
    return column.tasks;
  }
  if (rows <= 1) return column.tasks.slice(0, rows);
  return column.tasks.slice(0, Math.min(column.tasks.length, rows - 1));
}

function collapsedChips(
  columns: ColumnModel[],
  model: BoardModel,
  options: RenderOptions,
): string[] {
  const { style } = options;
  return columns.map(column => {
    const count = countLabel(column, model.filtered);
    if (column.isUncategorized) {
      return style(`${BOX.warn} ${count} uncategorized`, 'yellow');
    }
    return style(`${column.label.toLowerCase()} ${count}`, 'dim');
  });
}

function updatedLabel(at: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `updated ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

function hasVisibleWaitingTask(model: BoardModel, plan: Plan): boolean {
  const waiting = (task: Task) => model.blockedTaskSlugs.has(task.slug);
  if (plan.mode === 'columns') {
    return plan.rendered.some(column =>
      visibleTasks(column, plan.bodyRows).some(waiting),
    );
  }
  if (plan.mode === 'stacked') {
    return plan.sections.some(({ column, rows }) =>
      visibleTasks(column, rows).some(waiting),
    );
  }
  return false;
}

/**
 * One row, and it has to survive being 20 cells wide. Everything on it is ranked,
 * and parts are dropped from the least important end until the line fits — never
 * truncated mid-string, because a styled part cut in half leaves a dangling
 * escape sequence that bleeds colour into the rest of the frame.
 *
 * Rank, most important first: the last-updated timestamp; a non-fatal failure
 * notice; the uncategorized count; collapsed-column counts; the project name.
 */
function statusLine(
  model: BoardModel,
  plan: Plan,
  width: number,
  options: RenderOptions,
): string {
  const { style } = options;
  const collapsed =
    plan.mode === 'columns' || plan.mode === 'stacked' ? plan.collapsed : [];

  const alerts: string[] = [];
  if (model.notice) alerts.push(style(`${BOX.warn} ${model.notice}`, 'yellow'));
  if (model.staleSince) alerts.push(style(`${BOX.warn} stale`, 'yellow'));
  if (model.warnings.length > 0) {
    alerts.push(
      style(`${BOX.warn} ${model.warnings.length} warnings`, 'yellow'),
    );
  }

  // This is a record of the last successful read, not a liveness clock. Absolute
  // minute precision stays truthful without a timer; relative time would become
  // silently wrong on a quiet board.
  //
  // `keep` ranks survival, `order` fixes display position. The two are different
  // axes: collapsed chips are the first thing dropped but the leftmost thing
  // shown, so ranking alone would print them in the wrong order.
  interface Part {
    text: string;
    keep: number;
    order: number;
  }
  const parts: Part[] = [
    { text: style(updatedLabel(model.updatedAt), 'dim'), keep: 3, order: 300 },
    ...alerts.map((text, index) => ({ text, keep: 2, order: 200 + index })),
    ...collapsedChips(
      collapsed.filter(column => column.isUncategorized),
      model,
      options,
    ).map(text => ({ text, keep: 1, order: 100 })),
    ...collapsedChips(
      collapsed.filter(column => !column.isUncategorized),
      model,
      options,
    ).map((text, index) => ({ text, keep: 0, order: index })),
  ];

  const separator = style(` ${BOX.dot} `, 'dim');
  const kept: Part[] = [];
  let used = 0;
  for (const part of parts
    .slice()
    .sort((a, b) => b.keep - a.keep || a.order - b.order)) {
    const cost = displayWidth(stripSgr(part.text)) + (kept.length > 0 ? 3 : 0);
    if (used + cost > width) continue;
    kept.push(part);
    used += cost;
  }

  const right = kept
    .sort((a, b) => a.order - b.order)
    .map(part => part.text)
    .join(separator);
  const nameRoom = width - used;
  const nameWidth = displayWidth(model.projectName);
  if (nameRoom >= nameWidth + 2) {
    let left = style(model.projectName, 'dim');
    let leftWidth = nameWidth;
    if (hasVisibleWaitingTask(model, plan)) {
      const keyText = `${BOX.waiting} = waiting`;
      const keyWidth = displayWidth(keyText);
      const gap = 2;
      // The key is reference material, so it is the first left-side item to
      // disappear. Keep the same two-cell breathing room before the right group.
      if (nameRoom >= nameWidth + gap + keyWidth + 2) {
        left += `${' '.repeat(gap)}${style(keyText, 'dim')}`;
        leftWidth += gap + keyWidth;
      }
    }
    return `${left}${' '.repeat(nameRoom - leftWidth)}${right}`;
  }
  return `${' '.repeat(Math.max(0, nameRoom))}${right}`;
}

function renderColumns(
  model: BoardModel,
  plan: Extract<Plan, { mode: 'columns' }>,
  viewport: Viewport,
  options: RenderOptions,
): string[] {
  const { style } = options;
  const widths = plan.columnWidths;
  const format: RowFormat = {
    meter: meterFitsIn(plan.columnWidth, options.config.priority.values.length),
  };
  const cells = plan.rendered.map((column, index) => [
    sectionHeader(column, widths[index], model, options),
    ...columnBody(column, widths[index], plan.bodyRows, model, format, options),
  ]);

  const bodyHeight = Math.max(...cells.map(cell => cell.length));
  const rule = style(BOX.vertical, 'dim');
  const lines: string[] = [];

  for (let row = 0; row < bodyHeight; row += 1) {
    const parts = cells.map((cell, index) => {
      const line = cell[row] ?? '';
      const pad = Math.max(0, widths[index] - displayWidth(stripSgr(line)));
      return line + ' '.repeat(pad);
    });
    lines.push(` ${parts.join(` ${rule} `)} `);
  }

  // Push the status line to the bottom edge so it stays put as columns grow and
  // shrink; an operator learns where to look once.
  while (lines.length < viewport.height - 1) lines.push('');
  return [
    ...lines.slice(0, viewport.height - 1),
    statusLine(model, plan, viewport.width, options),
  ];
}

function renderStacked(
  model: BoardModel,
  plan: Extract<Plan, { mode: 'stacked' }>,
  viewport: Viewport,
  options: RenderOptions,
): string[] {
  const width = viewport.width;
  const format: RowFormat = {
    meter: meterFitsIn(width, options.config.priority.values.length),
  };
  const lines: string[] = [];

  for (const { column, rows } of plan.sections) {
    lines.push(sectionHeader(column, width, model, options));
    lines.push(...columnBody(column, width, rows, model, format, options));
  }

  while (lines.length < viewport.height - 1) lines.push('');
  return [
    ...lines.slice(0, viewport.height - 1),
    statusLine(model, plan, width, options),
  ];
}

export function renderBoard(
  model: BoardModel,
  viewport: Viewport,
  options: RenderOptions,
): string[] {
  const plan = planBoard(model, viewport);

  if (plan.mode === 'no-columns') {
    // Two ways to get here and they need different answers: a `--status` that
    // named nothing (the operator's typo), or a config with no columns at all
    // (which core currently accepts).
    const detail =
      model.unknownStatuses.length > 0
        ? `no column matches --status=${model.unknownStatuses.join(',')}`
        : 'no columns configured in .shipbench/config.json';
    return [truncate(`shipbench: ${detail}`, viewport.width)];
  }
  if (plan.mode === 'too-small') {
    return [truncate('shipbench: terminal too small', viewport.width)];
  }
  if (plan.mode === 'stacked') {
    return renderStacked(model, plan, viewport, options);
  }
  return renderColumns(model, plan, viewport, options);
}
