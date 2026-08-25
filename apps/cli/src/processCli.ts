import { statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { FsAdapter } from '@shipbench/core';
import type { Command } from 'commander';
import { type CliOptions, createCli } from './cli.js';

type ProcessCliOptions = Pick<CliOptions, 'out' | 'err' | 'exitOverride'> & {
  argv: readonly string[];
  shellCwd: string;
};

function projectDirectoryOption(argv: readonly string[]): string | undefined {
  let directory: string | undefined;

  // `-C` is a root option, so only inspect arguments before the subcommand.
  // Stop at `--` as Commander does for option processing.
  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--') break;

    if (argument === '-C') {
      const value = argv[index + 1];
      if (value === undefined || value === '--') return directory;
      directory = value;
      index += 1;
      continue;
    }

    if (argument?.startsWith('-C') && argument.length > 2) {
      directory = argument.slice(2);
      continue;
    }

    if (!argument?.startsWith('-')) break;
  }

  return directory;
}

export function resolveProjectDirectory(
  argv: readonly string[],
  shellCwd: string,
): string {
  const option = projectDirectoryOption(argv);
  if (option === undefined) return shellCwd;

  const directory = resolve(shellCwd, option);
  let stats: ReturnType<typeof statSync>;
  try {
    stats = statSync(directory);
  } catch (error) {
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : null;
    if (code === 'ENOENT') {
      throw new Error(
        `ShipBench project directory does not exist: ${directory}`,
      );
    }
    throw new Error(
      `Cannot access ShipBench project directory "${directory}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!stats.isDirectory()) {
    throw new Error(`ShipBench project path is not a directory: ${directory}`);
  }

  return directory;
}

export function createProcessCli(opts: ProcessCliOptions): Command {
  const cwd = resolveProjectDirectory(opts.argv, opts.shellCwd);
  return createCli({
    adapter: new FsAdapter(cwd),
    defaultProjectName: basename(cwd),
    cwd,
    out: opts.out,
    err: opts.err,
    exitOverride: opts.exitOverride,
  });
}
