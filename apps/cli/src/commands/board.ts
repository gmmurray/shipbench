import { type Command, InvalidArgumentError } from 'commander';
import {
  openBrowser,
  resolveBoardBundleDir,
  startBoardServer,
} from '../boardServer.js';
import { formatBoardStatus } from '../output.js';
import { runTui } from '../tui/run.js';
import type { CommandContext } from './context.js';
import { accumulateCommaList, commaList } from './options.js';

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new InvalidArgumentError('Port must be an integer from 1 to 65535.');
  }
  return port;
}

/** Registers `board` and its `web` and `terminal` surfaces. */
export function registerBoard(program: Command, ctx: CommandContext): void {
  const { adapter, cwd, chrome, output, requireBoard } = ctx;

  // `board` has two surfaces, and they are subcommands rather than a `--terminal`
  // flag because they share no options at all: `--port` and `--no-open` are
  // browser-only, the filters are terminal-only. As flags, `board --help` would
  // list six options with no signal that each silently does nothing in the other
  // mode. As subcommands the help text is correct by construction. `task comment`
  // already establishes the shape in this CLI — an action of its own plus
  // subcommands.
  const board = program.command('board').description('Open the board UI');

  // `web` is `board`'s default subcommand rather than a second copy of the
  // options on the parent: declaring `--port` in both places makes commander
  // route `board web --port` to the parent and hand `web` its defaults.
  // `isDefault` keeps every existing `shipbench board [--port] [--no-open]`
  // invocation working while the flags live on exactly one command.
  board
    .command('web', { isDefault: true })
    .description('Open the board UI in a browser (the default for `board`)')
    .option('--port <number>', 'Port to listen on', parsePort, 4321)
    .option('--no-open', 'Do not open the browser automatically')
    .action(async raw => {
      await requireBoard();
      const server = await startBoardServer({
        adapter,
        cwd,
        bundleDir: resolveBoardBundleDir(),
        port: raw.port,
        warn: chrome,
      });

      output.brand();
      for (const line of formatBoardStatus(server.url, cwd)) chrome(line);

      if (raw.open) openBrowser(server.url);

      const shutdown = async () => {
        await server.close();
        process.exit(0);
      };
      process.once('SIGINT', () => {
        void shutdown();
      });
      process.once('SIGTERM', () => {
        void shutdown();
      });

      await new Promise<void>(() => {});
    });

  board
    .command('terminal')
    .aliases(['term', 'tui'])
    .description('Render the board in the terminal (read-only, live, no input)')
    .option(
      '-s, --status <statuses>',
      'Columns to render (comma-separated; defaults to every configured column)',
      commaList,
    )
    .option('-a, --assignee <assignee>', 'Filter by assignee')
    .option('-p, --priority <priority>', 'Filter by priority')
    .option(
      '--tag <tag>',
      'Filter by tag (comma-separated or repeatable with AND semantics)',
      accumulateCommaList,
    )
    .option(
      '--exclude-tag <tag>',
      'Leave out tasks carrying any of these tags (comma-separated or repeatable)',
      accumulateCommaList,
    )
    .option('--flagged', 'Only tasks with a flag set')
    .addHelpText(
      'after',
      '\nTakes no keyboard input: Ctrl-C exits. Never writes to the board.\nWith stdout redirected it prints one 80x24 frame and exits.\n',
    )
    .action(async raw => {
      await requireBoard();
      await runTui({
        adapter,
        cwd,
        filters: {
          statuses: raw.status,
          tags: raw.tag,
          excludedTags: raw.excludeTag,
          assignee: raw.assignee,
          priority: raw.priority,
          flagged: raw.flagged,
        },
      });
    });
}
