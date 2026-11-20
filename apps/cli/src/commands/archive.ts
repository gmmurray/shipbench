import {
  ArchiveBlockedError,
  archiveTask,
  deleteTask,
  listTasks,
  type Task,
  tasksLinkingTo,
  unarchiveTask,
} from '@shipbench/core';
import type { Command } from 'commander';
import { type CommandContext, taskJson } from './context.js';
import { parseNonNegativeInteger } from './options.js';

/** Registers `task archive`, `task unarchive`, and `task delete`. */
export function registerArchive(task: Command, ctx: CommandContext): void {
  const { adapter, data, chrome, output, printTask } = ctx;

  task
    .command('archive [slug]')
    .description('Archive one task, or older done tasks in bulk')
    .option('--done', 'Archive done tasks in bulk')
    .option(
      '--keep <count>',
      'Number of most-recent done tasks to keep live',
      parseNonNegativeInteger,
    )
    .option(
      '--force',
      'Archive a non-done task even when live tasks depend on it',
    )
    .option(
      '--json',
      'Output the archived task as JSON (an array of them with --done)',
    )
    .addHelpText(
      'after',
      '\nA non-done task with live dependents is blocked unless --force is used.\n',
    )
    .action(async (slug: string | undefined, raw) => {
      if (Boolean(slug) === Boolean(raw.done)) {
        throw new Error('Provide either a task slug or --done, but not both.');
      }
      if (raw.keep !== undefined && !raw.done) {
        throw new Error('--keep can only be used with --done.');
      }
      if (raw.force && raw.done) {
        throw new Error('--force can only be used when archiving one task.');
      }

      const config = await ctx.loadConfig();
      // Archiving rewrites nobody's links, so a live task's relative link to an
      // archived one stops resolving. Name those tasks without blocking: the
      // links are prose, and fixing them is the writer's call.
      const warnAboutLinksToArchived = async (slugs: string[]) => {
        if (slugs.length === 0) return;
        const { tasks } = await listTasks(adapter, config);
        for (const archivedSlug of slugs) {
          const linking = tasksLinkingTo(tasks, archivedSlug);
          if (linking.length === 0) continue;
          output.warning(
            `${linking.join(', ')} ${linking.length === 1 ? 'links' : 'link'} to ${archivedSlug}, which is now at archive/${archivedSlug}.md. Update the link, or name ${archivedSlug} in related.`,
          );
        }
      };
      if (raw.done) {
        const { tasks } = await listTasks(adapter, config);
        const doneTasks = tasks
          .filter(
            candidate => candidate.frontmatter.status === config.done_column,
          )
          .sort(
            (a, b) =>
              Date.parse(b.frontmatter.updated) -
                Date.parse(a.frontmatter.updated) ||
              a.slug.localeCompare(b.slug),
          );
        const keep =
          raw.keep === undefined && config.done_display.max <= 0
            ? doneTasks.length
            : (raw.keep ?? config.done_display.max);
        const candidates = doneTasks.slice(keep);

        const archived: Task[] = [];
        for (const candidate of candidates) {
          archived.push(await archiveTask(adapter, config, candidate.slug));
          if (!raw.json) chrome(`Archived task: ${candidate.slug}`);
        }
        await warnAboutLinksToArchived(archived.map(task => task.slug));
        if (raw.json) {
          data(JSON.stringify(archived.map(taskJson), null, 2));
          return;
        }
        if (candidates.length === 0) chrome('No done tasks archived.');
        return;
      }

      try {
        const archived = await archiveTask(adapter, config, slug!, {
          force: raw.force,
        });
        if (raw.json) {
          printTask(archived);
        } else {
          chrome(`Archived task: ${slug}`);
        }
        await warnAboutLinksToArchived([archived.slug]);
      } catch (error) {
        if (error instanceof ArchiveBlockedError) {
          throw new Error(
            `Cannot archive "${error.slug}" because live tasks depend on it: ${error.dependentSlugs.join(', ')}. Re-run with --force to archive it anyway.`,
          );
        }
        throw error;
      }
    });

  task
    .command('unarchive <slug>')
    .description('Restore an archived task')
    .option('--json', 'Output the resulting task as JSON')
    .action(async (slug: string, raw: { json?: boolean }) => {
      const config = await ctx.loadConfig();
      const restored = await unarchiveTask(adapter, config, slug);
      if (raw.json) {
        printTask(restored);
        return;
      }
      chrome(`Unarchived task: ${slug}`);
    });

  task
    .command('delete <slug>')
    .description('Delete a task')
    .option('--json', 'Output the deleted slug as JSON')
    .action(async (slug: string, raw: { json?: boolean }) => {
      const config = await ctx.loadConfig();
      await deleteTask(adapter, config, slug);
      if (raw.json) {
        data(JSON.stringify({ slug, deleted: true }, null, 2));
        return;
      }
      chrome(`Deleted task: ${slug}`);
    });
}
