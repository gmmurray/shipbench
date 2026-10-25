import { existsSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { FsAdapter } from '@shipbench/core';
import type { Command } from 'commander';
import { type CliOptions, createCli } from './cli.js';
import { formatMissingBoard } from './output.js';

type ProcessCliOptions = Pick<CliOptions, 'out' | 'err' | 'exitOverride'> & {
  argv: readonly string[];
  shellCwd: string;
};

interface RootArguments {
  /** The `-C` value, unresolved. */
  directory: string | undefined;
  /** The first argument after the root options: the command's name. */
  command: string | undefined;
}

function rootArguments(argv: readonly string[]): RootArguments {
  let directory: string | undefined;

  // `-C` is a root option, so only inspect arguments before the subcommand.
  // Stop at `--` as Commander does for option processing.
  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--') break;

    if (argument === '-C') {
      const value = argv[index + 1];
      if (value === undefined || value === '--') {
        return { directory, command: undefined };
      }
      directory = value;
      index += 1;
      continue;
    }

    if (argument?.startsWith('-C') && argument.length > 2) {
      directory = argument.slice(2);
      continue;
    }

    if (argument !== undefined && !argument.startsWith('-')) {
      return { directory, command: argument };
    }
  }

  return { directory, command: undefined };
}

export function resolveProjectDirectory(
  argv: readonly string[],
  shellCwd: string,
): string {
  const option = rootArguments(argv).directory;
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

const BOARD_DIRECTORY = '.shipbench';

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export type BoardSearch =
  /** `root` holds `.shipbench/config.json`. */
  | { kind: 'found'; root: string }
  /** `root` holds a `.shipbench/` directory but no `config.json`. */
  | { kind: 'incomplete'; root: string }
  /** No board. `boundary` is the top level the walk stopped at, or null when
   *  it ran to the filesystem root outside any repository. */
  | { kind: 'none'; boundary: string | null };

/**
 * Walks up from `start` to the nearest board.
 *
 * The first `.shipbench/` ends the walk even without a `config.json`: a nested
 * board whose config was deleted must not hand its writes to the board above
 * it. A `.git` entry ends it too, as a directory at a repository's top level or
 * as a file at a linked worktree's or a submodule's, so the walk never leaves
 * the checkout it started in.
 */
export function findBoard(start: string): BoardSearch {
  let directory = start;
  for (;;) {
    if (isDirectory(join(directory, BOARD_DIRECTORY))) {
      return existsSync(join(directory, BOARD_DIRECTORY, 'config.json'))
        ? { kind: 'found', root: directory }
        : { kind: 'incomplete', root: directory };
    }
    if (existsSync(join(directory, '.git'))) {
      return { kind: 'none', boundary: directory };
    }
    const parent = dirname(directory);
    if (parent === directory) return { kind: 'none', boundary: null };
    directory = parent;
  }
}

export interface ResolvedBoard {
  /** The directory the adapter is rooted at. */
  directory: string;
  /** Where the search started: the shell's directory or the `-C` target. */
  start: string;
  /** What to say when `directory` turns out to hold no board. */
  missingMessage: string;
  /** For `init`: a board above `start` inside the same checkout. */
  ancestorBoard?: string;
}

function missingMessage(start: string, search: BoardSearch): string {
  if (search.kind !== 'none') return formatMissingBoard(`in ${search.root}`);
  if (search.boundary === start) return formatMissingBoard(`in ${start}`);
  if (search.boundary === null) {
    return formatMissingBoard(`in ${start} or any directory above it`);
  }
  return formatMissingBoard(`in ${start} or above it up to ${search.boundary}`);
}

/**
 * Decides which board a command runs against. `init` creates a board where it
 * runs, and `-C` names a board exactly, so neither walks. Every other command
 * uses the nearest board at or above the shell's directory.
 */
export function resolveBoard(
  argv: readonly string[],
  shellCwd: string,
): ResolvedBoard {
  const start = resolveProjectDirectory(argv, shellCwd);
  const { directory: option, command } = rootArguments(argv);
  const exact = {
    directory: start,
    start,
    missingMessage: formatMissingBoard(`in ${start}`),
  };

  if (command === 'init') {
    if (existsSync(join(start, '.git'))) return exact;
    const parent = dirname(start);
    const above = parent === start ? undefined : findBoard(parent);
    return above?.kind === 'found'
      ? { ...exact, ancestorBoard: above.root }
      : exact;
  }
  if (option !== undefined) return exact;

  const search = findBoard(start);
  return {
    directory: search.kind === 'none' ? start : search.root,
    start,
    missingMessage: missingMessage(start, search),
  };
}

export function createProcessCli(opts: ProcessCliOptions): Command {
  const board = resolveBoard(opts.argv, opts.shellCwd);
  return createCli({
    adapter: new FsAdapter(board.directory),
    defaultProjectName: basename(board.start),
    cwd: board.directory,
    searchedFrom: board.start,
    missingBoardMessage: board.missingMessage,
    ancestorBoard: board.ancestorBoard,
    out: opts.out,
    err: opts.err,
    exitOverride: opts.exitOverride,
  });
}
