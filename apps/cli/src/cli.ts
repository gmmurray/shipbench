import {
  ArchiveBlockedError,
  addComment,
  archiveTask,
  buildTaskDependencyGraph,
  createTask,
  deleteComment,
  deleteTask,
  editComment,
  getTask,
  initProject,
  inspectProjectInitialization,
  listArchivedTasks,
  listAvailableTasks,
  listBlockedTasks,
  listTasks,
  loadConfig,
  moveTask,
  orderedTasksForColumn,
  type ProjectWarning,
  reorderTask,
  type ShipbenchConfig,
  type StorageAdapter,
  searchTasks,
  type Task,
  taskFileSlugs,
  unarchiveTask,
  updateTask,
} from '@shipbench/core';
import { readFile } from 'node:fs/promises';
import { Command, InvalidArgumentError, Option } from 'commander';
import {
  openBrowser,
  resolveBoardBundleDir,
  startBoardServer,
} from './boardServer.js';
import {
  CliExitError,
  connectPreparedProjectToHarbor,
  type GitRunner,
  prepareHarborConnection,
  runGitCommand,
} from './harborConnect.js';
import {
  createCliOutput,
  formatBoardStatus,
  formatInitNextSteps,
} from './output.js';
import { runTui } from './tui/run.js';

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
  /** Where command output goes. Defaults to console.log. */
  out?: (line: string) => void;
  /** Where errors go. Defaults to console.error. */
  err?: (line: string) => void;
  /** HTTP client used by Harbor connect commands. Defaults to global fetch. */
  fetch?: typeof fetch;
  /** Git command runner used by Harbor connect commands. */
  runGit?: GitRunner;
  /** Reads a `--body-file` path as UTF-8. Defaults to node:fs/promises. */
  readTextFile?: (path: string) => Promise<string>;
  /** Reads stdin for `--body-file -`. Defaults to consuming process.stdin. */
  readStdin?: () => Promise<string>;
  /** Whether stdout is an interactive terminal. Defaults to process.stdout.isTTY. */
  isInteractive?: boolean;
  /** Environment used for terminal capability checks. Defaults to process.env. */
  env?: NodeJS.ProcessEnv;
  /** When true, commander throws on errors instead of calling process.exit. */
  exitOverride?: boolean;
}

function commaList(value: string): string[] {
  return value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/** Supports both `--depends-on a,b` and a repeated `--depends-on a --depends-on b`. */
function accumulateCommaList(value: string, previous?: string[]): string[] {
  return [...(previous ?? []), ...commaList(value)];
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new InvalidArgumentError('Port must be an integer from 1 to 65535.');
  }
  return port;
}

function parseNonNegativeInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new InvalidArgumentError('Value must be a non-negative integer.');
  }
  return parsed;
}

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

function orderTasksForBoard(
  tasks: Task[],
  config: ShipbenchConfig,
): { tasks: Task[]; positions: Map<string, number> } {
  const validStatuses = new Set(config.columns.map(column => column.id));
  const ordered: Task[] = [];
  const positions = new Map<string, number>();

  for (const { id } of config.columns) {
    const columnTasks = orderedTasksForColumn(
      tasks,
      config.layout,
      id,
      validStatuses,
      config.done_column,
    );
    columnTasks.forEach((task, position) => {
      positions.set(task.slug, position);
    });
    ordered.push(...columnTasks);
  }

  let uncategorizedId = '__uncategorized__';
  while (validStatuses.has(uncategorizedId)) uncategorizedId += '_';
  const uncategorizedTasks = orderedTasksForColumn(
    tasks,
    config.layout,
    uncategorizedId,
    validStatuses,
    config.done_column,
  );
  uncategorizedTasks.forEach((task, position) => {
    positions.set(task.slug, position);
  });
  ordered.push(...uncategorizedTasks);

  return { tasks: ordered, positions };
}

function formatTaskDependencyGraph(
  graph: ReturnType<typeof buildTaskDependencyGraph>,
): string[] {
  const entries = Object.entries(graph);
  if (entries.length === 0) return ['Task dependency graph: empty'];

  const lines = ['Task dependency graph:'];
  for (const [index, [slug, node]] of entries.entries()) {
    const isLast = index === entries.length - 1;
    const connector = isLast ? '`-' : '+-';
    const childPrefix = isLast ? '  ' : '| ';
    const formatTarget = (target: string) =>
      `${target} [${graph[target]?.status ?? 'missing'}]`;
    const dependencies = node.depends_on.map(formatTarget).join(', ') || 'none';
    const blocks = node.blocks.map(formatTarget).join(', ') || 'none';

    lines.push(`${connector} ${slug} [${node.status}]`);
    lines.push(`${childPrefix}+- depends on: ${dependencies}`);
    lines.push(`${childPrefix}\`- blocks: ${blocks}`);
  }
  return lines;
}

interface BodyOptions {
  body?: string;
  bodyFile?: string;
}

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

async function readProcessStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function enableExitOverride(command: Command): void {
  command.exitOverride();
  for (const child of command.commands) enableExitOverride(child);
}

function formatProjectWarning(warning: ProjectWarning): string {
  const source = 'path' in warning ? warning.path : warning.slug;
  return `${source}: ${warning.message}`;
}

export function createCli(opts: CliOptions): Command {
  const { adapter, defaultProjectName } = opts;
  const cwd = opts.cwd ?? process.cwd();
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
  const loadCliConfig = () =>
    loadConfig(adapter, {
      onWarning: warning => {
        output.warning(`${warning.path}: ${warning.message}`);
      },
    });
  const fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init));
  const runGit = opts.runGit ?? runGitCommand;
  const readTextFile =
    opts.readTextFile ?? ((path: string) => readFile(path, 'utf8'));
  const readStdin = opts.readStdin ?? readProcessStdin;

  /** Resolves `--body` / `--body-file` to the description, or undefined when neither was passed. */
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

  /**
   * Resolves update text from the positional argument or the body options.
   * Only one of the two may be present: silently preferring either would let a
   * mistyped command write text the caller did not mean to record. Commander
   * reports an omitted optional argument as `null`, not `undefined`.
   */
  const resolveUpdateText = async (
    command: Command,
    positional: string | null | undefined,
    raw: BodyOptions,
  ): Promise<string | undefined> => {
    const fromOption = await resolveBody(raw);
    if (positional != null && fromOption !== undefined) {
      command.error(
        'Pass the update text once: either positionally or with --body / --body-file, not both.',
      );
      return undefined;
    }
    return positional ?? fromOption;
  };

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
    .version(VERSION, '-v, --version', 'output the version')
    .option(
      '-C <path>',
      'Run as if ShipBench was started in the specified directory',
    );

  program.configureOutput({
    writeOut: line => data(line.replace(/\n$/, '')),
    writeErr: line => chrome(line.replace(/\n$/, '')),
  });

  program
    .command('init')
    .description(
      'Initialize ShipBench in the current repository; leave an existing valid project unchanged',
    )
    .option(
      '-n, --name <name>',
      'Project name (defaults to current directory name)',
    )
    .option(
      '--harbor <connect-url>',
      'Safely initialize, then connect the repository origin to Harbor with a signed URL',
    )
    .action(async raw => {
      const name =
        (raw.name ?? defaultProjectName).trim() || defaultProjectName;
      let prepared:
        | Awaited<ReturnType<typeof prepareHarborConnection>>
        | undefined;
      if (raw.harbor) {
        try {
          prepared = await prepareHarborConnection(raw.harbor, cwd, runGit);
        } catch (error) {
          if (error instanceof CliExitError) {
            throw new CliExitError(
              `ShipBench initialization did not run, and Harbor was not contacted. ${error.message}`,
              error.exitCode,
            );
          }
          throw error;
        }
      }

      let result: Awaited<ReturnType<typeof initProject>>;
      try {
        result = await initProject(adapter, { name });
      } catch (error) {
        throw new CliExitError(
          `ShipBench files were not modified, and Harbor was not contacted. ${
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
          `ShipBench files were not modified, and Harbor was not contacted. Existing project name "${result.config.name}" does not match --name "${name}".`,
          2,
        );
      }
      output.brand();
      for (const warning of result.warnings) {
        output.warning(formatProjectWarning(warning));
      }

      const operationStatus = result.created
        ? 'ShipBench initialization completed.'
        : 'ShipBench was already initialized and remains unchanged.';
      if (result.created) {
        chrome(`Initialized .shipbench/ for "${name}" in current directory.`);
      } else {
        chrome(`ShipBench is already initialized for "${result.config.name}".`);
      }

      if (prepared) {
        const message = await connectPreparedProjectToHarbor({
          prepared,
          runGit,
          fetch: fetchImpl,
          warn: chrome,
          operationStatus,
        });
        chrome(message);
      }
      if (result.created) {
        for (const line of formatInitNextSteps(Boolean(prepared))) chrome(line);
      }
    });

  program
    .command('connect')
    .description(
      'Connect an existing ShipBench project to Harbor without modifying project files',
    )
    .requiredOption('--harbor <connect-url>', 'Signed Harbor connect URL')
    .action(async raw => {
      let prepared: Awaited<ReturnType<typeof prepareHarborConnection>>;
      try {
        prepared = await prepareHarborConnection(raw.harbor, cwd, runGit);
      } catch (error) {
        if (error instanceof CliExitError) {
          throw new CliExitError(
            `ShipBench project files were not modified, and Harbor was not contacted. ${error.message}`,
            error.exitCode,
          );
        }
        throw error;
      }

      const state = await inspectProjectInitialization(adapter);
      if (state.kind === 'missing') {
        throw new CliExitError(
          'ShipBench project files were not modified, and Harbor was not contacted. This repository is not initialized. Run shipbench init first.',
          2,
        );
      }
      if (state.kind !== 'initialized') {
        const detail =
          state.kind === 'incomplete'
            ? `ShipBench project is incomplete because .shipbench/config.json is missing while these files exist: ${state.paths.join(', ')}.`
            : `ShipBench project is ${state.kind}: ${state.errors.join(' ')}`;
        throw new CliExitError(
          `ShipBench project files were not modified, and Harbor was not contacted. ${detail}`,
          2,
        );
      }

      for (const warning of state.warnings) {
        output.warning(formatProjectWarning(warning));
      }
      const message = await connectPreparedProjectToHarbor({
        prepared,
        runGit,
        fetch: fetchImpl,
        warn: chrome,
        operationStatus: 'ShipBench project files remain unchanged.',
      });
      chrome(message);
    });

  const task = program.command('task').description('Manage tasks');
  task
    .command('create <title>')
    .description('Create a new task')
    .option('-s, --status <status>', 'Column to place the task in')
    .option('-a, --assignee <assignee>', 'Assignee label')
    .option('-p, --priority <priority>', 'Priority value')
    .option('-t, --tags <tags>', 'Comma-separated tags', commaList)
    .option(
      '-d, --depends-on <slugs>',
      'Slugs this task depends on (comma-separated, repeatable)',
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
      const body = await resolveBody(raw);
      const config = await loadCliConfig();
      const created = await createTask(
        adapter,
        config,
        title,
        {
          status: raw.status,
          assignee: raw.assignee,
          priority: raw.priority,
          tags: raw.tags,
          depends_on: raw.dependsOn,
        },
        body,
      );

      if (raw.json) {
        data(
          JSON.stringify(
            {
              slug: created.slug,
              status: created.frontmatter.status,
              frontmatter: created.frontmatter,
              body: created.body,
              comments: created.comments,
            },
            null,
            2,
          ),
        );
        return;
      }
      chrome(`Created task: ${created.slug}`);
    });

  const editCommand = task
    .command('edit <slug>')
    .description("Replace a task's Markdown description")
    .addOption(bodyOption())
    .addOption(bodyFileOption())
    .option('--json', 'Output the edited task as JSON')
    .addHelpText(
      'after',
      '\nThe description is replaced whole and an empty value clears it. The Task\nUpdates section is never touched — use `shipbench task comment` for those.\n',
    );

  editCommand.action(async (slug: string, raw) => {
    const body = await resolveBody(raw);
    if (body === undefined) {
      editCommand.error(
        'Provide --body <text> or --body-file <path> (use "-" to read stdin).',
      );
      return;
    }

    const config = await loadCliConfig();
    const existing = await getTask(adapter, config, slug);
    if (!existing) {
      const archived = await getTask(adapter, config, slug, { archived: true });
      editCommand.error(
        archived
          ? `Task '${slug}' is archived. Unarchive it before editing.`
          : `Task '${slug}' not found.`,
      );
      return;
    }

    const { task: edited } = await updateTask(adapter, config, slug, {}, body);

    if (raw.json) {
      data(
        JSON.stringify(
          {
            slug: edited.slug,
            status: edited.frontmatter.status,
            frontmatter: edited.frontmatter,
            body: edited.body,
            comments: edited.comments,
          },
          null,
          2,
        ),
      );
      return;
    }
    chrome(
      body.trim()
        ? `Updated description on ${edited.slug}`
        : `Cleared description on ${edited.slug}`,
    );
  });

  const BODY_FILE_HELP =
    '\nPrefer --body-file for anything multi-line: the file is read as UTF-8 by\nShipBench, so the text never passes through shell quoting or encoding.\n';

  const commentCommand = task
    .command('comment')
    .description('Manage timestamped entries in the task Updates section')
    .argument('[slug]', 'Task slug')
    .argument('[text]', 'Update text')
    .addOption(updateTextOption())
    .addOption(updateTextFileOption())
    .addHelpText('after', BODY_FILE_HELP);

  commentCommand.action(async (slug: string | undefined, text, raw) => {
    const resolved = await resolveUpdateText(commentCommand, text, raw);
    if (!slug || resolved === undefined) {
      throw new InvalidArgumentError(
        'Append requires a task slug and update text (positional, --body <text>, or --body-file <path>).',
      );
    }
    const config = await loadCliConfig();
    const updated = await addComment(adapter, config, slug, resolved);
    chrome(`Added update to ${updated.slug}`);
  });

  const commentEditCommand = commentCommand
    .command('edit <slug> <index> [text]')
    .description(
      'Edit an Updates entry by zero-based index without changing its timestamp',
    )
    .addOption(updateTextOption())
    .addOption(updateTextFileOption())
    .addHelpText('after', BODY_FILE_HELP);

  commentEditCommand.action(async (slug: string, index: string, text, raw) => {
    const resolved = await resolveUpdateText(commentEditCommand, text, raw);
    if (resolved === undefined) {
      commentEditCommand.error(
        'Provide the replacement text positionally, or with --body <text> or --body-file <path>.',
      );
      return;
    }
    const config = await loadCliConfig();
    const parsedIndex = parseNonNegativeInteger(index);
    const updated = await editComment(
      adapter,
      config,
      slug,
      parsedIndex,
      resolved,
    );
    chrome(`Edited update ${parsedIndex} on ${updated.slug}`);
  });

  commentCommand
    .command('delete <slug> <index>')
    .description('Delete an Updates entry by zero-based index')
    .action(async (slug: string, index: string) => {
      const config = await loadCliConfig();
      const parsedIndex = parseNonNegativeInteger(index);
      const updated = await deleteComment(adapter, config, slug, parsedIndex);
      chrome(`Deleted update ${parsedIndex} from ${updated.slug}`);
    });

  const getTaskCommand = task
    .command('get <slug>')
    .description('Retrieve one task as JSON')
    .option('--archived', 'Retrieve the task from the archive instead');

  getTaskCommand.action(async (slug: string, raw) => {
    const config = await loadCliConfig();
    const found = await getTask(adapter, config, slug, {
      archived: raw.archived,
    });

    if (!found) {
      if (!raw.archived) {
        const archived = await getTask(adapter, config, slug, {
          archived: true,
        });
        if (archived) {
          getTaskCommand.error(
            `Task '${slug}' is archived. Pass --archived to retrieve.`,
          );
          return;
        }
      }
      getTaskCommand.error(`Task '${slug}' not found.`);
      return;
    }

    data(
      JSON.stringify(
        {
          slug: found.slug,
          status: found.frontmatter.status,
          frontmatter: found.frontmatter,
          body: found.body,
          comments: found.comments,
        },
        null,
        2,
      ),
    );
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
    .addHelpText(
      'after',
      '\nPlacement flags are mutually exclusive and cannot target the done column,\nwhich is always ordered by last update. Reorder only when asked to.\n',
    )
    .action(async (slug: string, raw: MoveOptions) => {
      const config = await loadCliConfig();
      const placement = readPlacement(raw);

      if (!placement) {
        if (raw.to === undefined) {
          moveCommand.error(
            'Provide --to, a placement flag (--top, --bottom, --before, --after, --position), or both.',
          );
          return;
        }
        const moved = await moveTask(adapter, config, slug, raw.to);
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

      const placedAt =
        position < 0 || position > column.length ? column.length : position;
      chrome(
        fromStatus === toStatus
          ? `Reordered ${moved.slug} in ${toStatus} → position ${placedAt} of ${column.length + 1}`
          : `Moved ${moved.slug} → ${toStatus} at position ${placedAt} of ${column.length + 1}`,
      );
      chrome('Wrote .shipbench/layout.json');
    });

  task
    .command('list')
    .description('List live tasks in board order, optionally filtered')
    .option('-s, --status <status>', 'Filter by status')
    .option('-a, --assignee <assignee>', 'Filter by assignee')
    .option('-p, --priority <priority>', 'Filter by priority')
    .option(
      '--tag <tag>',
      'Filter by tag (comma-separated or repeatable with AND semantics)',
      accumulateCommaList,
    )
    .addOption(
      new Option(
        '--available',
        'List tasks whose dependencies are satisfied (ranked by priority then age, not board order)',
      ).conflicts('blocked'),
    )
    .addOption(
      new Option(
        '--blocked',
        'List tasks with unsatisfied dependencies (ranked like --available)',
      ).conflicts('available'),
    )
    .option(
      '--limit <n>',
      'Maximum number of tasks to return (0 returns none)',
      parseNonNegativeInteger,
    )
    .option('--archived', 'List archived tasks instead of live tasks')
    .option('--json', 'Emit machine-readable JSON instead of text')
    .option(
      '--include-body',
      'Include Markdown descriptions and Updates in JSON output',
    )
    .action(async raw => {
      if (raw.archived && (raw.available || raw.blocked)) {
        throw new InvalidArgumentError(
          '--available and --blocked cannot be used with --archived.',
        );
      }

      const config = await loadCliConfig();
      const archivedPromise = raw.archived
        ? undefined
        : listArchivedTasks(adapter, config);
      const result = raw.archived
        ? await listArchivedTasks(adapter, config)
        : await listTasks(adapter, config, {
            archivedTasks: archivedPromise?.then(result => result.tasks),
            archivedSlugs: archivedPromise?.then(taskFileSlugs),
          });
      const archived = await archivedPromise;
      const boardOrder = raw.archived
        ? undefined
        : orderTasksForBoard(result.tasks, config);
      let candidates = boardOrder?.tasks ?? result.tasks;
      if (raw.available || raw.blocked) {
        candidates = raw.available
          ? listAvailableTasks(candidates, config, {
              status: raw.status,
              archivedTasks: archived?.tasks,
              archivedSlugs: archived ? taskFileSlugs(archived) : undefined,
            })
          : listBlockedTasks(candidates, config, {
              status: raw.status,
              archivedTasks: archived?.tasks,
              archivedSlugs: archived ? taskFileSlugs(archived) : undefined,
            });
      }

      const requestedTags = (raw.tag ?? []) as string[];
      const filtered = candidates
        .filter(
          t =>
            (raw.available ||
              raw.blocked ||
              !raw.status ||
              t.frontmatter.status === raw.status) &&
            (!raw.assignee || t.frontmatter.assignee === raw.assignee) &&
            (!raw.priority || t.frontmatter.priority === raw.priority) &&
            requestedTags.every(requestedTag =>
              (t.frontmatter.tags ?? []).some(
                tag => tag.toLowerCase() === requestedTag.toLowerCase(),
              ),
            ),
        )
        .slice(0, raw.limit);

      if (raw.json) {
        const tasks = filtered.map(t => ({
          slug: t.slug,
          ...t.frontmatter,
          depends_on: t.frontmatter.depends_on ?? [],
          ...(boardOrder ? { position: boardOrder.positions.get(t.slug) } : {}),
          ...(raw.includeBody ? { body: t.body, comments: t.comments } : {}),
        }));
        const payload = raw.archived
          ? { archived: true, tasks, warnings: result.warnings }
          : { tasks, warnings: result.warnings };
        data(JSON.stringify(payload, null, 2));
        return;
      }

      if (raw.archived) data('Archived tasks:');
      for (const t of filtered) {
        data(`[${t.frontmatter.status}] ${t.frontmatter.title} (${t.slug})`);
      }
      if (result.warnings.length > 0) {
        chrome('');
        chrome('Warnings:');
        for (const w of result.warnings) {
          chrome(`  ${w.slug}: ${w.message}`);
        }
      }
    });

  task
    .command('search <query>')
    .description('Search task titles, tags, and Markdown bodies')
    .option('--archived', 'Search archived tasks instead of live tasks')
    .addOption(
      new Option('--all', 'Search both live and archived tasks').conflicts(
        'archived',
      ),
    )
    .option(
      '--limit <n>',
      'Maximum number of matches to return (0 returns none)',
      parseNonNegativeInteger,
    )
    .option('--json', 'Emit machine-readable JSON instead of text')
    .option('--include-body', 'Include Markdown bodies in JSON output')
    .action(async (query: string, raw) => {
      if (!query.trim()) {
        throw new InvalidArgumentError('Search query must not be blank.');
      }

      const config = await loadCliConfig();
      const liveResult =
        raw.archived && !raw.all ? undefined : await listTasks(adapter, config);
      const archivedResult =
        raw.archived || raw.all
          ? await listArchivedTasks(adapter, config)
          : undefined;
      const candidates = [
        ...(liveResult?.tasks ?? []),
        ...(archivedResult?.tasks ?? []),
      ];
      const allMatches = searchTasks(candidates, query);
      const matches = allMatches.slice(0, raw.limit);
      const warnings = [
        ...(liveResult?.warnings ?? []),
        ...(archivedResult?.warnings ?? []),
      ];

      if (raw.json) {
        const tasksBySlug = new Map(
          candidates.map(candidate => [candidate.slug, candidate]),
        );
        const payloadMatches = matches.map(match => ({
          ...match,
          ...(raw.includeBody
            ? { body: tasksBySlug.get(match.slug)?.body ?? '' }
            : {}),
        }));
        data(JSON.stringify({ matches: payloadMatches, warnings }, null, 2));
        return;
      }

      if (allMatches.length === 0) {
        data(`No matches for "${query.trim()}".`);
      } else {
        if (raw.archived && matches.length > 0) {
          data('Archived task matches:');
        }
        for (const match of matches) {
          data(
            `${match.title} (${match.slug}) [${match.matched_fields.join(', ')}]`,
          );
          if (match.snippet) data(`  ${match.snippet}`);
        }
      }
      if (warnings.length > 0) {
        chrome('');
        chrome('Warnings:');
        for (const warning of warnings) {
          chrome(`  ${warning.slug}: ${warning.message}`);
        }
      }
    });

  task
    .command('graph')
    .description('Show the task dependency graph')
    .option('--archived', 'Include archived tasks as graph nodes')
    .option('--json', 'Emit machine-readable JSON')
    .action(async raw => {
      const config = await loadCliConfig();
      const liveResult = await listTasks(adapter, config);
      const archivedResult = raw.archived
        ? await listArchivedTasks(adapter, config)
        : undefined;
      const graph = buildTaskDependencyGraph(liveResult.tasks, {
        archivedTasks: archivedResult?.tasks,
        archivedSlugs: archivedResult
          ? taskFileSlugs(archivedResult)
          : undefined,
      });

      if (raw.json || !isInteractive) {
        data(JSON.stringify(graph, null, 2));
        return;
      }

      for (const line of formatTaskDependencyGraph(graph)) data(line);
    });

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

      const config = await loadCliConfig();
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

        for (const candidate of candidates) {
          await archiveTask(adapter, config, candidate.slug);
          chrome(`Archived task: ${candidate.slug}`);
        }
        if (candidates.length === 0) chrome('No done tasks archived.');
        return;
      }

      try {
        await archiveTask(adapter, config, slug!, { force: raw.force });
        chrome(`Archived task: ${slug}`);
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
    .action(async (slug: string) => {
      const config = await loadCliConfig();
      await unarchiveTask(adapter, config, slug);
      chrome(`Unarchived task: ${slug}`);
    });

  task
    .command('delete <slug>')
    .description('Delete a task')
    .action(async (slug: string) => {
      const config = await loadCliConfig();
      await deleteTask(adapter, config, slug);
      chrome(`Deleted task: ${slug}`);
    });

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
    .addHelpText(
      'after',
      '\nTakes no keyboard input: Ctrl-C exits. Never writes to the board.\nWith stdout redirected it prints one 80x24 frame and exits.\n',
    )
    .action(async raw => {
      await runTui({
        adapter,
        cwd,
        filters: {
          statuses: raw.status,
          tags: raw.tag,
          assignee: raw.assignee,
          priority: raw.priority,
        },
      });
    });

  if (opts.exitOverride) enableExitOverride(program);
  return program;
}
