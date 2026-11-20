import { validateProject } from '@shipbench/core';
import type { Command } from 'commander';
import { CliExitError } from '../errors.js';
import { CONFIG_PATH } from '../tui/paths.js';
import {
  formatValidationProblems,
  formatValidationSummary,
  validationReportJson,
} from '../validation.js';
import type { CommandContext } from './context.js';

/** Registers `validate`. */
export function registerValidate(program: Command, ctx: CommandContext): void {
  const { adapter, data, chrome, missingBoardMessage } = ctx;

  program
    .command('validate')
    .description(
      "Check the project's config, layout, and task files for structural problems, without changing them",
    )
    .option('--archived', 'Also check the files in tasks/archive/')
    .option('--json', 'Emit the report as machine-readable JSON')
    .addHelpText(
      'after',
      '\nExits 0 when nothing is an error (warnings alone pass), 1 when anything is,\nand 2 when the check could not run. It checks structure only: it cannot tell\nwhether a task is finished or its reasoning is sound.\n',
    )
    .action(async raw => {
      if ((await adapter.readFileIfExists(CONFIG_PATH)) === null) {
        throw new CliExitError(missingBoardMessage, 2);
      }
      let report: Awaited<ReturnType<typeof validateProject>>;
      try {
        report = await validateProject(adapter, {
          archived: Boolean(raw.archived),
        });
      } catch (error) {
        throw new CliExitError(
          `Could not validate the project: ${
            error instanceof Error ? error.message : String(error)
          }`,
          2,
        );
      }

      if (raw.json) {
        data(JSON.stringify(validationReportJson(report), null, 2));
      } else {
        for (const line of formatValidationProblems(report)) data(line);
      }

      const summary = formatValidationSummary(report);
      if (!report.valid) throw new CliExitError(summary, 1);
      if (!raw.json) chrome(summary);
    });
}
