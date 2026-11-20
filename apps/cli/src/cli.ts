import { readFile } from 'node:fs/promises';
import { loadConfig, type StorageAdapter, type Task } from '@shipbench/core';
import { Command } from 'commander';
import { registerArchive } from './commands/archive.js';
import { registerBoard } from './commands/board.js';
import {
  type BodyOptions,
  type CommandContext,
  taskJson,
} from './commands/context.js';
import { registerInit } from './commands/init.js';
import { registerTaskGet, registerTaskQueries } from './commands/taskQuery.js';
import { registerTaskState } from './commands/taskState.js';
import { registerTaskWrite } from './commands/taskWrite.js';
import { registerValidate } from './commands/validate.js';
import { createCliOutput, formatMissingBoard } from './output.js';
import { CONFIG_PATH } from './tui/paths.js';

// Replaced at build time by tsup; falls back to '0.0.0-dev' for source runs
// (e.g. tests) where the define hasn't been applied.
declare const __SHIPBENCH_VERSION__: string | undefined;
const VERSION =
  typeof __SHIPBENCH_VERSION__ === 'string'
    ? __SHIPBENCH_VERSION__
    : '0.0.0-dev';

export interface CliOptions {
  adapter: StorageAdapter;
  /** Fallback project name used by `init` when `--name` is not provided. */
  defaultProjectName: string;
  /** Repository root served by `board`. Defaults to process.cwd(). */
  cwd?: string;
  /**
   * Where the board search started. When it differs from `cwd`, the board was
   * found above it, and commands that write say which board they used.
   */
  searchedFrom?: string;
  /** Said when `cwd` holds no `.shipbench/config.json`. Defaults to naming `cwd`. */
  missingBoardMessage?: string;
  /** A board above `cwd` in the same checkout, which `init` mentions. */
  ancestorBoard?: string;
  /** Where command output goes. Defaults to console.log. */
  out?: (line: string) => void;
  /** Where errors go. Defaults to console.error. */
  err?: (line: string) => void;
  /** Reads a `--body-file` path as UTF-8. Defaults to node:fs/promises. */
  readTextFile?: (path: string) => Promise<string>;
  /** Reads stdin for `--body-file -`. Defaults to consuming process.stdin. */
  readStdin?: () => Promise<string>;
  /** Whether stdout is an interactive terminal. Defaults to process.stdout.isTTY. */
  isInteractive?: boolean;
  /** Environment used for terminal capability checks. Defaults to process.env. */
  env?: NodeJS.ProcessEnv;
  /** The version `--version` prints and `init` stamps. Defaults to the build's. */
  version?: string;
  /** When true, commander throws on errors instead of calling process.exit. */
  exitOverride?: boolean;
}

async function readProcessStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function enableExitOverride(command: Command): void {
  command.exitOverride();
  for (const child of command.commands) enableExitOverride(child);
}

export function createCli(opts: CliOptions): Command {
  const { adapter, defaultProjectName } = opts;
  const cwd = opts.cwd ?? process.cwd();
  const version = opts.version ?? VERSION;
  const writeData = opts.out ?? ((line: string) => console.log(line));
  const writeChrome = opts.err ?? ((line: string) => console.error(line));
  const isInteractive = opts.isInteractive ?? process.stdout.isTTY === true;
  const output = createCliOutput({
    writeData,
    writeChrome,
    isStdoutTty: isInteractive,
    env: opts.env ?? process.env,
  });
  const { data, chrome } = output;
  const missingBoardMessage =
    opts.missingBoardMessage ?? formatMissingBoard(`in ${cwd}`);
  const requireBoard = async () => {
    if ((await adapter.readFileIfExists(CONFIG_PATH)) === null) {
      throw new Error(missingBoardMessage);
    }
  };
  const loadCliConfig = async () => {
    try {
      return await loadConfig(adapter, {
        onWarning: warning => {
          output.warning(`${warning.path}: ${warning.message}`);
        },
      });
    } catch (error) {
      await requireBoard();
      throw error;
    }
  };
  const readTextFile =
    opts.readTextFile ?? ((path: string) => readFile(path, 'utf8'));
  const readStdin = opts.readStdin ?? readProcessStdin;

  const resolveBody = async (raw: BodyOptions): Promise<string | undefined> => {
    if (raw.bodyFile === undefined) return raw.body;
    if (raw.bodyFile === '-') return readStdin();
    try {
      return await readTextFile(raw.bodyFile);
    } catch (error) {
      throw new Error(
        `Cannot read --body-file "${raw.bodyFile}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };

  const printTask = (task: Task) =>
    data(JSON.stringify(taskJson(task), null, 2));

  const program = new Command()
    .name('shipbench')
    .description('Git-native project management for solo developers.')
    // Each command's options are parsed where they are written. Without this,
    // an option declared on a parent claims every later occurrence of its flag,
    // so `task comment edit <slug> <index> --body-file <path>` hands the path
    // to `task comment` and leaves the subcommand with nothing. It also stops
    // `-C` from being read anywhere but before the subcommand, which is the
    // only place `resolveProjectDirectory` looks for it.
    .enablePositionalOptions()
    .version(version, '-v, --version', 'output the version')
    .option(
      '-C <path>',
      'Use the board in the specified directory, without searching above it',
    );

  // The commands that change a task. When the board was found above the
  // directory the command ran in, they name it before writing, so a write from
  // a directory without a board of its own never lands somewhere unannounced.
  const writingCommands = new Set([
    'task create',
    'task edit',
    'task comment',
    'task comment edit',
    'task comment delete',
    'task flag',
    'task unflag',
    'task move',
    'task archive',
    'task unarchive',
    'task delete',
  ]);
  if (opts.searchedFrom !== undefined && opts.searchedFrom !== cwd) {
    program.hook('preAction', (_root, action) => {
      const names: string[] = [];
      for (let command: Command | null = action; command?.parent; ) {
        names.unshift(command.name());
        command = command.parent;
      }
      if (writingCommands.has(names.join(' '))) {
        chrome(`Using .shipbench/ from ${cwd}`);
      }
    });
  }

  program.configureOutput({
    writeOut: line => data(line.replace(/\n$/, '')),
    writeErr: line => chrome(line.replace(/\n$/, '')),
  });

  const ctx: CommandContext = {
    adapter,
    cwd,
    isInteractive,
    output,
    data,
    chrome,
    missingBoardMessage,
    requireBoard,
    loadConfig: loadCliConfig,
    resolveBody,
    printTask,
  };

  // Registration order is the order `--help` lists commands in, which is why
  // `task get` registers apart from the other queries.
  registerInit(program, ctx, {
    defaultProjectName,
    ancestorBoard: opts.ancestorBoard,
    version,
  });
  registerValidate(program, ctx);

  const task = program.command('task').description('Manage tasks');
  registerTaskWrite(task, ctx);
  registerTaskGet(task, ctx);
  registerTaskState(task, ctx);
  registerTaskQueries(task, ctx);
  registerArchive(task, ctx);

  registerBoard(program, ctx);

  if (opts.exitOverride) enableExitOverride(program);
  return program;
}
