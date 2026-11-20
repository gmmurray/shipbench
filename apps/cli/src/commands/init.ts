import { initProject, type ProjectWarning } from '@shipbench/core';
import type { Command } from 'commander';
import { CliExitError } from '../errors.js';
import { formatInitNextSteps } from '../output.js';
import type { CommandContext } from './context.js';

export interface InitSettings {
  /** Fallback project name used when `--name` is not provided. */
  defaultProjectName: string;
  /** A board above `cwd` in the same checkout, which `init` mentions. */
  ancestorBoard?: string;
  /** The running ShipBench version, stamped into the scaffold. */
  version: string;
}

function formatProjectWarning(warning: ProjectWarning): string {
  const source = 'path' in warning ? warning.path : warning.slug;
  return `${source}: ${warning.message}`;
}

/** Registers `init`. */
export function registerInit(
  program: Command,
  ctx: CommandContext,
  settings: InitSettings,
): void {
  const { adapter, chrome, output } = ctx;
  const { defaultProjectName, ancestorBoard, version } = settings;

  program
    .command('init')
    .description(
      'Initialize ShipBench in the current repository; leave an existing valid project unchanged',
    )
    .option(
      '-n, --name <name>',
      'Project name (defaults to current directory name)',
    )
    .action(async raw => {
      const name =
        (raw.name ?? defaultProjectName).trim() || defaultProjectName;

      let result: Awaited<ReturnType<typeof initProject>>;
      try {
        result = await initProject(adapter, { name, version });
      } catch (error) {
        throw new CliExitError(
          `ShipBench files were not modified. ${
            error instanceof Error ? error.message : 'Initialization failed.'
          }`,
          2,
        );
      }

      if (
        !result.created &&
        raw.name !== undefined &&
        result.config.name !== name
      ) {
        throw new CliExitError(
          `ShipBench files were not modified. Existing project name "${result.config.name}" does not match --name "${name}".`,
          2,
        );
      }
      output.brand();
      for (const warning of result.warnings) {
        output.warning(formatProjectWarning(warning));
      }

      if (result.created) {
        chrome(`Initialized .shipbench/ for "${name}" in current directory.`);
        if (ancestorBoard !== undefined) {
          chrome(
            `Note: ${ancestorBoard} already has a .shipbench/ board. This one is separate, and tasks on one cannot depend on tasks on the other.`,
          );
        }
      } else {
        chrome(`ShipBench is already initialized for "${result.config.name}".`);
        for (const file of result.scaffold) {
          if (file.version !== null && file.version !== version) {
            chrome(
              `${file.path} was written by ShipBench ${file.version}; this is ${version}.`,
            );
          }
        }
      }

      if (result.created) {
        for (const line of formatInitNextSteps()) chrome(line);
      }
    });
}
