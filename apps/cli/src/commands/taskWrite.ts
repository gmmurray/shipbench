import {
  addComment,
  createTask,
  deleteComment,
  editComment,
  listArchivedTasks,
  listTasks,
  relatedSlugs,
  type Task,
  updateTask,
} from '@shipbench/core';
import { type Command, InvalidArgumentError, Option } from 'commander';
import {
  type BodyOptions,
  type CommandContext,
  requireLiveTask,
} from './context.js';
import {
  diffTaskEdit,
  relatedRemovalsNotRecordedHere,
  requestsMetadataChange,
  type TaskEditRequest,
} from './editFields.js';
import {
  accumulateCommaList,
  dedupePreservingCase,
  parseNonNegativeInteger,
} from './options.js';

/**
 * `--body-file` is the documented path for agents because the alternatives
 * route the description through the shell: a quoted multi-line argument hits
 * PowerShell quoting rules, and a pipe hits PowerShell 5.1's Windows-1252
 * decode, which corrupts every non-ASCII character. Reading the file here means
 * Node opens it as UTF-8 and the bytes never touch the shell.
 */
function bodyOption(): Option {
  return new Option('--body <text>', 'Description as Markdown text').conflicts([
    'bodyFile',
  ]);
}

function bodyFileOption(): Option {
  return new Option(
    '--body-file <path>',
    'Read the description from a UTF-8 file; "-" reads stdin',
  ).conflicts(['body']);
}

/**
 * The same pair for `task comment`, which is the command most likely to be
 * handed long prose and was the last one that could only take it as a quoted
 * argument. Both reuse the `body` / `bodyFile` option names so `resolveBody`
 * serves every command that takes Markdown.
 */
function updateTextOption(): Option {
  return new Option('--body <text>', 'Update text as Markdown').conflicts([
    'bodyFile',
  ]);
}

function updateTextFileOption(): Option {
  return new Option(
    '--body-file <path>',
    'Read the update text from a UTF-8 file; "-" reads stdin',
  ).conflicts(['body']);
}

const commaListOption = (flags: string, description: string): Option =>
  new Option(flags, description).argParser(accumulateCommaList);

const BODY_FILE_HELP =
  '\nPrefer --body-file for anything multi-line: the file is read as UTF-8 by\nShipBench, so the text never passes through shell quoting or encoding.\n';

/**
 * Resolves update text from the positional argument or the body options.
 * Only one of the two may be present: silently preferring either would let a
 * mistyped command write text the caller did not mean to record. Commander
 * reports an omitted optional argument as `null`, not `undefined`.
 */
async function resolveUpdateText(
  ctx: CommandContext,
  command: Command,
  positional: string | null | undefined,
  raw: BodyOptions,
): Promise<string | undefined> {
  const fromOption = await ctx.resolveBody(raw);
  if (positional != null && fromOption !== undefined) {
    command.error(
      'Pass the update text once: either positionally or with --body / --body-file, not both.',
    );
    return undefined;
  }
  return positional ?? fromOption;
}

/** Registers `task create`, `task edit`, and `task comment`. */
export function registerTaskWrite(task: Command, ctx: CommandContext): void {
  const { adapter, chrome, printTask } = ctx;

  task
    .command('create <title>')
    .description('Create a new task')
    .option('-s, --status <status>', 'Column to place the task in')
    .option('-a, --assignee <assignee>', 'Assignee label')
    .option('-p, --priority <priority>', 'Priority value')
    .option(
      '-t, --tags <tags>',
      'Tags (comma-separated, repeatable)',
      accumulateCommaList,
    )
    .option(
      '-d, --depends-on <slugs>',
      'Slugs this task depends on (comma-separated, repeatable)',
      accumulateCommaList,
      [] as string[],
    )
    .option(
      '--related <slugs>',
      'Slugs of live or archived tasks this one relates to, without depending on them (comma-separated, repeatable)',
      accumulateCommaList,
      [] as string[],
    )
    .addOption(bodyOption())
    .addOption(bodyFileOption())
    .option('--json', 'Output the created task as JSON')
    .addHelpText(
      'after',
      '\nPrefer --body-file for anything multi-line: the file is read as UTF-8 by\nShipBench, so the description never passes through shell quoting or encoding.\n',
    )
    .action(async (title: string, raw) => {
      const body = await ctx.resolveBody(raw);
      const config = await ctx.loadConfig();
      const created = await createTask(
        adapter,
        config,
        title,
        {
          status: raw.status,
          assignee: raw.assignee,
          priority: raw.priority,
          tags: raw.tags && dedupePreservingCase(raw.tags),
          depends_on: raw.dependsOn,
          related: raw.related,
        },
        body,
      );

      if (raw.json) {
        printTask(created);
        return;
      }
      chrome(`Created task: ${created.slug}`);
    });

  const editCommand = task
    .command('edit <slug>')
    .description("Revise a task's description or its validated metadata")
    .option(
      '--title <text>',
      'Set the title (the slug and filename do not change)',
    )
    .option('-p, --priority <value>', 'Set the priority')
    .addOption(
      new Option('-a, --assignee <label>', 'Set the assignee label').conflicts([
        'clearAssignee',
      ]),
    )
    .addOption(
      new Option('--clear-assignee', 'Remove the assignee').conflicts([
        'assignee',
      ]),
    )
    .addOption(
      commaListOption(
        '-t, --tags <tags>',
        'Replace every tag (comma-separated or repeatable)',
      ).conflicts(['addTag', 'removeTag', 'clearTags']),
    )
    .addOption(
      commaListOption(
        '--add-tag <tags>',
        'Add tags, keeping the others (comma-separated or repeatable)',
      ).conflicts(['tags', 'clearTags']),
    )
    .addOption(
      commaListOption(
        '--remove-tag <tags>',
        'Remove tags, keeping the others (comma-separated or repeatable)',
      ).conflicts(['tags', 'clearTags']),
    )
    .addOption(
      new Option('--clear-tags', 'Remove every tag').conflicts([
        'tags',
        'addTag',
        'removeTag',
      ]),
    )
    .addOption(
      commaListOption(
        '-d, --depends-on <slugs>',
        'Replace every dependency (comma-separated or repeatable)',
      ).conflicts(['addDependsOn', 'removeDependsOn', 'clearDependsOn']),
    )
    .addOption(
      commaListOption(
        '--add-depends-on <slugs>',
        'Add dependencies, keeping the others (comma-separated or repeatable)',
      ).conflicts(['dependsOn', 'clearDependsOn']),
    )
    .addOption(
      commaListOption(
        '--remove-depends-on <slugs>',
        'Remove dependencies, keeping the others (comma-separated or repeatable)',
      ).conflicts(['dependsOn', 'clearDependsOn']),
    )
    .addOption(
      new Option('--clear-depends-on', 'Remove every dependency').conflicts([
        'dependsOn',
        'addDependsOn',
        'removeDependsOn',
      ]),
    )
    .addOption(
      commaListOption(
        '--related <slugs>',
        'Replace every related task (comma-separated or repeatable)',
      ).conflicts(['addRelated', 'removeRelated', 'clearRelated']),
    )
    .addOption(
      commaListOption(
        '--add-related <slugs>',
        'Add related tasks, keeping the others (comma-separated or repeatable)',
      ).conflicts(['related', 'clearRelated']),
    )
    .addOption(
      commaListOption(
        '--remove-related <slugs>',
        'Remove related tasks, keeping the others (comma-separated or repeatable)',
      ).conflicts(['related', 'clearRelated']),
    )
    .addOption(
      new Option(
        '--clear-related',
        "Remove every related task this task's file records",
      ).conflicts(['related', 'addRelated', 'removeRelated']),
    )
    .addOption(bodyOption())
    .addOption(bodyFileOption())
    .option('--json', 'Output the edited task as JSON')
    .addHelpText(
      'after',
      '\nPass at least one change. Every change is applied in a single validated\nwrite: if any value is rejected the task is left exactly as it was. Status\nand board placement stay with `shipbench task move`; the Task Updates section\nstays with `shipbench task comment`. A title edit never renames the file.\n',
    );

  editCommand.action(async (slug: string, raw) => {
    const body = await ctx.resolveBody(raw);
    const request: TaskEditRequest = {
      title: raw.title,
      priority: raw.priority,
      assignee: raw.assignee,
      clearAssignee: Boolean(raw.clearAssignee),
      tags: raw.tags,
      addTag: raw.addTag,
      removeTag: raw.removeTag,
      clearTags: Boolean(raw.clearTags),
      dependsOn: raw.dependsOn,
      addDependsOn: raw.addDependsOn,
      removeDependsOn: raw.removeDependsOn,
      clearDependsOn: Boolean(raw.clearDependsOn),
      related: raw.related,
      addRelated: raw.addRelated,
      removeRelated: raw.removeRelated,
      clearRelated: Boolean(raw.clearRelated),
    };

    if (body === undefined && !requestsMetadataChange(request)) {
      editCommand.error(
        'Provide at least one change: --body/--body-file, --title, --priority, ' +
          '--assignee/--clear-assignee, --tags/--add-tag/--remove-tag/--clear-tags, ' +
          '--depends-on/--add-depends-on/--remove-depends-on/--clear-depends-on, ' +
          'or --related/--add-related/--remove-related/--clear-related.',
      );
      return;
    }

    const config = await ctx.loadConfig();
    const existing = await requireLiveTask(
      ctx,
      editCommand,
      config,
      slug,
      'editing',
    );
    if (!existing) return;

    const notOwn = relatedRemovalsNotRecordedHere(existing, request);
    if (notOwn.length > 0) {
      const [live, archived] = await Promise.all([
        listTasks(adapter, config),
        listArchivedTasks(adapter, config),
      ]);
      const holds = (candidate: Task, target: string) =>
        candidate.slug === target && relatedSlugs(candidate).includes(slug);
      for (const target of notOwn) {
        if (live.tasks.some(candidate => holds(candidate, target))) {
          editCommand.error(
            `Cannot remove related task "${target}" from ${slug}: the link is recorded in ${target}'s file, not this one. Remove it there: shipbench task edit ${target} --remove-related ${slug}`,
          );
          return;
        }
        if (archived.tasks.some(candidate => holds(candidate, target))) {
          editCommand.error(
            `Cannot remove related task "${target}" from ${slug}: the link is recorded in the archived task ${target}'s file, not this one. Unarchive ${target} to edit it.`,
          );
          return;
        }
      }
    }

    const { fields, changes } = diffTaskEdit(existing, request);
    if (body !== undefined) {
      changes.push(body.trim() ? 'description' : 'description cleared');
    }

    if (changes.length === 0) {
      // Nothing to write — every requested value already matches. Report the
      // task unchanged rather than bumping `updated` for a no-op.
      if (raw.json) {
        printTask(existing);
        return;
      }
      chrome(`No changes for ${slug}: every field already holds that value.`);
      return;
    }

    const { task: edited } = await updateTask(
      adapter,
      config,
      slug,
      fields,
      body,
    );

    if (raw.json) {
      printTask(edited);
      return;
    }
    chrome(`Updated ${edited.slug}: ${changes.join('; ')}`);
    if (fields.title !== undefined) {
      chrome(`Slug and filename unchanged: ${edited.slug}`);
    }
  });

  const commentCommand = task
    .command('comment')
    .description('Manage timestamped entries in the task Updates section')
    .argument('[slug]', 'Task slug')
    .argument('[text]', 'Update text')
    .addOption(updateTextOption())
    .addOption(updateTextFileOption())
    .option('--json', 'Output the resulting task as JSON')
    .addHelpText('after', BODY_FILE_HELP);

  commentCommand.action(async (slug: string | undefined, text, raw) => {
    const resolved = await resolveUpdateText(ctx, commentCommand, text, raw);
    if (!slug || resolved === undefined) {
      throw new InvalidArgumentError(
        'Append requires a task slug and update text (positional, --body <text>, or --body-file <path>).',
      );
    }
    const config = await ctx.loadConfig();
    const updated = await addComment(adapter, config, slug, resolved);
    if (raw.json) {
      printTask(updated);
      return;
    }
    chrome(`Added update to ${updated.slug}`);
  });

  const commentEditCommand = commentCommand
    .command('edit <slug> <index> [text]')
    .description(
      'Edit an Updates entry by zero-based index without changing its timestamp',
    )
    .addOption(updateTextOption())
    .addOption(updateTextFileOption())
    .option('--json', 'Output the resulting task as JSON')
    .addHelpText('after', BODY_FILE_HELP);

  commentEditCommand.action(async (slug: string, index: string, text, raw) => {
    const resolved = await resolveUpdateText(
      ctx,
      commentEditCommand,
      text,
      raw,
    );
    if (resolved === undefined) {
      commentEditCommand.error(
        'Provide the replacement text positionally, or with --body <text> or --body-file <path>.',
      );
      return;
    }
    const config = await ctx.loadConfig();
    const parsedIndex = parseNonNegativeInteger(index);
    const updated = await editComment(
      adapter,
      config,
      slug,
      parsedIndex,
      resolved,
    );
    if (raw.json) {
      printTask(updated);
      return;
    }
    chrome(`Edited update ${parsedIndex} on ${updated.slug}`);
  });

  commentCommand
    .command('delete <slug> <index>')
    .description('Delete an Updates entry by zero-based index')
    .option('--json', 'Output the resulting task as JSON')
    .action(async (slug: string, index: string, raw: { json?: boolean }) => {
      const config = await ctx.loadConfig();
      const parsedIndex = parseNonNegativeInteger(index);
      const updated = await deleteComment(adapter, config, slug, parsedIndex);
      if (raw.json) {
        printTask(updated);
        return;
      }
      chrome(`Deleted update ${parsedIndex} from ${updated.slug}`);
    });
}
