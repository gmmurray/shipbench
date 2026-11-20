import {
  getTask,
  listTasks,
  moveTask,
  orderedTasksForColumn,
  reorderTask,
  taskFlag,
  updateTask,
} from '@shipbench/core';
import { type Command, InvalidArgumentError, Option } from 'commander';
import { type CommandContext, requireLiveTask } from './context.js';

/** `--position` mirrors core: a 0-based index, with `-1` meaning "append". */
function parseLayoutPosition(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < -1) {
    throw new InvalidArgumentError(
      'Position must be an integer of -1 or greater (-1 appends).',
    );
  }
  return parsed;
}

type Placement =
  | { kind: 'top' }
  | { kind: 'bottom' }
  | { kind: 'before'; anchor: string }
  | { kind: 'after'; anchor: string }
  | { kind: 'position'; index: number };

interface MoveOptions {
  to?: string;
  top?: boolean;
  bottom?: boolean;
  before?: string;
  after?: string;
  position?: number;
  json?: boolean;
}

/**
 * The one placement flag the user passed, if any. Commander's `.conflicts()`
 * has already rejected combinations, so at most one can be set here.
 */
function readPlacement(raw: MoveOptions): Placement | undefined {
  if (raw.top) return { kind: 'top' };
  if (raw.bottom) return { kind: 'bottom' };
  if (raw.before !== undefined) return { kind: 'before', anchor: raw.before };
  if (raw.after !== undefined) return { kind: 'after', anchor: raw.after };
  if (raw.position !== undefined) {
    return { kind: 'position', index: raw.position };
  }
  return undefined;
}

/** Registers `task flag`, `task unflag`, and `task move`. */
export function registerTaskState(task: Command, ctx: CommandContext): void {
  const { adapter, chrome, printTask } = ctx;

  const flagCommand = task
    .command('flag <slug> [reason]')
    .description('Flag a task for attention, with an optional one-line reason')
    .option('--json', 'Output the resulting task as JSON')
    .addHelpText(
      'after',
      "\nWhat a flag means is the project's call. A flag never moves the task, and\nnothing clears it for you: run `shipbench task unflag <slug>` once it no\nlonger applies. Flagging a flagged task replaces its reason.\n",
    );

  flagCommand.action(
    async (
      slug: string,
      reason: string | null | undefined,
      raw: { json?: boolean },
    ) => {
      const config = await ctx.loadConfig();
      const existing = await requireLiveTask(
        ctx,
        flagCommand,
        config,
        slug,
        'flagging',
      );
      if (!existing) return;

      // Commander reports an omitted optional argument as `null`. Core rejects a
      // blank or multi-line reason, so the message comes from one place.
      const flag = reason == null ? true : reason;
      const before = taskFlag(existing);
      if (before && before.reason === (flag === true ? null : flag.trim())) {
        if (raw.json) {
          printTask(existing);
          return;
        }
        chrome(`No changes for ${slug}: it already carries that flag.`);
        return;
      }

      const { task: flagged } = await updateTask(adapter, config, slug, {
        flag,
      });
      if (raw.json) {
        printTask(flagged);
        return;
      }
      const after = taskFlag(flagged);
      chrome(
        after?.reason
          ? `Flagged ${flagged.slug}: ${after.reason}`
          : `Flagged ${flagged.slug}`,
      );
    },
  );

  const unflagCommand = task
    .command('unflag <slug>')
    .description("Clear a task's flag")
    .option('--json', 'Output the resulting task as JSON');

  unflagCommand.action(async (slug: string, raw: { json?: boolean }) => {
    const config = await ctx.loadConfig();
    const existing = await requireLiveTask(
      ctx,
      unflagCommand,
      config,
      slug,
      'unflagging',
    );
    if (!existing) return;

    // A malformed value (`flag: false`, say) reads as unflagged but is still in
    // the file, so only an absent field is a no-op.
    if (existing.frontmatter.flag === undefined) {
      if (raw.json) {
        printTask(existing);
        return;
      }
      chrome(`No changes for ${slug}: it is not flagged.`);
      return;
    }
    const { task: unflagged } = await updateTask(adapter, config, slug, {
      flag: undefined,
    });
    if (raw.json) {
      printTask(unflagged);
      return;
    }
    chrome(`Unflagged ${slug}`);
  });

  const moveCommand = task
    .command('move <slug>')
    .description('Move a task to another column and/or another position')
    .option(
      '-t, --to <status>',
      "Target column (defaults to the task's current column)",
    )
    .addOption(
      new Option('--top', 'Place first in the destination column').conflicts([
        'bottom',
        'before',
        'after',
        'position',
      ]),
    )
    .addOption(
      new Option('--bottom', 'Place last in the destination column').conflicts([
        'top',
        'before',
        'after',
        'position',
      ]),
    )
    .addOption(
      new Option(
        '--before <slug>',
        'Place immediately before this task',
      ).conflicts(['top', 'bottom', 'after', 'position']),
    )
    .addOption(
      new Option(
        '--after <slug>',
        'Place immediately after this task',
      ).conflicts(['top', 'bottom', 'before', 'position']),
    )
    .addOption(
      new Option('--position <n>', 'Place at this 0-based index (-1 appends)')
        .argParser(parseLayoutPosition)
        .conflicts(['top', 'bottom', 'before', 'after']),
    )
    .option('--json', 'Output the resulting task as JSON')
    .addHelpText(
      'after',
      '\nPlacement flags are mutually exclusive and cannot target the done column,\nwhich is always ordered by last update. Reorder only when asked to.\n',
    )
    .action(async (slug: string, raw: MoveOptions) => {
      const config = await ctx.loadConfig();
      const placement = readPlacement(raw);

      if (!placement) {
        if (raw.to === undefined) {
          moveCommand.error(
            'Provide --to, a placement flag (--top, --bottom, --before, --after, --position), or both.',
          );
          return;
        }
        const moved = await moveTask(adapter, config, slug, raw.to);
        if (raw.json) {
          printTask(moved);
          return;
        }
        chrome(`Moved ${moved.slug} → ${moved.frontmatter.status}`);
        return;
      }

      const { tasks } = await listTasks(adapter, config);
      const target = tasks.find(candidate => candidate.slug === slug);
      if (!target) {
        moveCommand.error(`Task '${slug}' not found.`);
        return;
      }

      const toStatus = raw.to ?? target.frontmatter.status;
      const validStatuses = new Set(config.columns.map(column => column.id));
      if (!validStatuses.has(toStatus)) {
        moveCommand.error(
          `Invalid status "${toStatus}". Valid: ${[...validStatuses].join(', ')}`,
        );
        return;
      }
      if (toStatus === config.done_column) {
        moveCommand.error(
          `The '${toStatus}' column carries no manual order — it is always sorted by last update. Move without a placement flag.`,
        );
        return;
      }

      // `layoutAfterMove` splices the task into the destination column *after*
      // removing it, so every position below is an index into the column as it
      // looks without this task.
      const column = orderedTasksForColumn(
        tasks,
        config.layout,
        toStatus,
        validStatuses,
        config.done_column,
      ).filter(candidate => candidate.slug !== slug);

      let position: number;
      if (placement.kind === 'top') {
        position = 0;
      } else if (placement.kind === 'bottom') {
        position = -1;
      } else if (placement.kind === 'position') {
        position = placement.index;
      } else {
        const { anchor } = placement;
        if (anchor === slug) {
          moveCommand.error(`Cannot place '${slug}' ${placement.kind} itself.`);
          return;
        }
        const anchorIndex = column.findIndex(
          candidate => candidate.slug === anchor,
        );
        if (anchorIndex === -1) {
          const live = tasks.find(candidate => candidate.slug === anchor);
          if (live) {
            moveCommand.error(
              `Anchor task '${anchor}' is in the '${live.frontmatter.status}' column, not '${toStatus}'.`,
            );
          } else if (
            await getTask(adapter, config, anchor, { archived: true })
          ) {
            moveCommand.error(
              `Anchor task '${anchor}' is archived and is not on the board.`,
            );
          } else {
            moveCommand.error(`Anchor task '${anchor}' not found.`);
          }
          return;
        }
        position = placement.kind === 'before' ? anchorIndex : anchorIndex + 1;
      }

      const fromStatus = target.frontmatter.status;
      const { task: moved } = await reorderTask(
        adapter,
        config,
        slug,
        toStatus,
        position,
      );

      if (raw.json) {
        printTask(moved);
        return;
      }

      const placedAt =
        position < 0 || position > column.length ? column.length : position;
      chrome(
        fromStatus === toStatus
          ? `Reordered ${moved.slug} in ${toStatus} → position ${placedAt} of ${column.length + 1}`
          : `Moved ${moved.slug} → ${toStatus} at position ${placedAt} of ${column.length + 1}`,
      );
      chrome('Wrote .shipbench/layout.json');
    });
}
