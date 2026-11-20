import {
  buildTaskDependencyGraph,
  createRelatedIndex,
  getTask,
  isTaskFlagged,
  listArchivedTasks,
  listAvailableTasks,
  listBlockedTasks,
  listTasks,
  orderedTasksForColumn,
  queryTaskDependencies,
  type ShipbenchConfig,
  searchTasks,
  type Task,
  type TaskDependencyQuery,
  type TaskDependencyQueryNode,
  taskFileSlugs,
  taskFlag,
  type UnreadableTaskFile,
  unreadableUpdatesWarning,
} from '@shipbench/core';
import { type Command, InvalidArgumentError, Option } from 'commander';
import { type CommandContext, taskJson } from './context.js';
import { accumulateCommaList, parseNonNegativeInteger } from './options.js';

/**
 * The multi-value filter rule, shared by `task list` and `task search`:
 * `--status` and `--priority` take a comma-separated or repeated list and match
 * any of the named values. A value that is not a configured column or priority
 * cannot match anything, so it is an error with the valid set spelled out
 * rather than a silently empty result. `--assignee` is freeform and has no
 * canonical set to check against, so it is not validated here.
 */
function assertKnownFilterValues(
  command: Command,
  label: 'status' | 'priority',
  values: string[] | undefined,
  valid: readonly string[],
): void {
  if (!values || values.length === 0) return;
  const validSet = new Set(valid);
  const unknown = values.filter(value => !validSet.has(value));
  if (unknown.length > 0) {
    command.error(
      `Unknown ${label} ${unknown
        .map(value => `"${value}"`)
        .join(', ')}. Valid: ${valid.join(', ')}`,
    );
  }
}

interface RawTaskFilters {
  status?: string[];
  assignee?: string[];
  priority?: string[];
  tag?: string[];
  excludeTag?: string[];
  flagged?: boolean;
}

interface ResolvedTaskFilters {
  statuses: string[];
  assignees: string[];
  priorities: string[];
  tags: string[];
  excludedTags: string[];
  flagged: boolean;
}

/** Parses and validates the shared `task list` / `task search` filter flags. */
function resolveTaskFilters(
  command: Command,
  raw: RawTaskFilters,
  config: ShipbenchConfig,
): ResolvedTaskFilters {
  const statuses = raw.status ?? [];
  const priorities = raw.priority ?? [];
  assertKnownFilterValues(
    command,
    'status',
    statuses,
    config.columns.map(column => column.id),
  );
  assertKnownFilterValues(
    command,
    'priority',
    priorities,
    config.priority.values,
  );
  return {
    statuses,
    priorities,
    assignees: raw.assignee ?? [],
    tags: raw.tag ?? [],
    excludedTags: raw.excludeTag ?? [],
    flagged: Boolean(raw.flagged),
  };
}

/**
 * `--status`, `--priority`, and `--assignee` each match a task whose value is
 * any of the ones listed; `--tag` narrows with AND, `--exclude-tag` drops a
 * task carrying any of its tags, and `--flagged` keeps only flagged tasks. `ignoreStatus` is set when `--available` / `--blocked` has
 * already used the status list to pick the candidate column.
 */
function taskMatchesFilters(
  task: Task,
  filters: ResolvedTaskFilters,
  options: { ignoreStatus?: boolean } = {},
): boolean {
  const { frontmatter } = task;
  if (
    !options.ignoreStatus &&
    filters.statuses.length > 0 &&
    !filters.statuses.includes(frontmatter.status)
  ) {
    return false;
  }
  if (
    filters.priorities.length > 0 &&
    (frontmatter.priority === undefined ||
      !filters.priorities.includes(frontmatter.priority))
  ) {
    return false;
  }
  if (
    filters.assignees.length > 0 &&
    (frontmatter.assignee === undefined ||
      !filters.assignees.includes(frontmatter.assignee))
  ) {
    return false;
  }
  if (filters.flagged && !isTaskFlagged(task)) return false;
  const taskTags = (frontmatter.tags ?? []).map(tag => tag.toLowerCase());
  if (
    filters.excludedTags.some(unwanted =>
      taskTags.includes(unwanted.toLowerCase()),
    )
  ) {
    return false;
  }
  return filters.tags.every(wanted => taskTags.includes(wanted.toLowerCase()));
}

/** Appended to a task's one-line text form, so a flag is never missed in a list. */
function flagSuffix(task: Task): string {
  const flag = taskFlag(task);
  if (!flag) return '';
  return flag.reason ? ` — flagged: ${flag.reason}` : ' — flagged';
}

function parsePositiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new InvalidArgumentError('Value must be a positive integer.');
  }
  return parsed;
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

function formatTaskDependencyQuery(query: TaskDependencyQuery): string[] {
  const state = query.available
    ? 'available'
    : query.dependencies_satisfied
      ? 'dependencies satisfied'
      : 'blocked';
  const lines = [
    `${query.slug} [${query.status}]: ${state}${query.invalid_depends_on ? ', invalid depends_on' : ''}`,
  ];

  const describe = (node: TaskDependencyQueryNode): string => {
    const notes: string[] = [];
    if (node.satisfied !== undefined) {
      notes.push(node.satisfied ? 'satisfied' : 'unsatisfied');
    }
    if (node.unblocks_on_completion) notes.push('unblocks on completion');
    if (node.waiting_on?.length) {
      notes.push(`waiting on ${node.waiting_on.join(', ')}`);
    }
    if (node.invalid_depends_on) notes.push('invalid depends_on');
    if (node.omitted === 'repeat') notes.push('expanded above');
    if (node.omitted === 'cycle') notes.push('cycle');
    if (node.omitted === 'depth') notes.push('more beyond --depth');
    const suffix = notes.length > 0 ? ` (${notes.join('; ')})` : '';
    return `${node.slug} [${node.status}]${suffix}`;
  };
  const tree = (nodes: TaskDependencyQueryNode[], prefix: string) => {
    nodes.forEach((node, index) => {
      const isLast = index === nodes.length - 1;
      lines.push(`${prefix}${isLast ? '`-' : '+-'} ${describe(node)}`);
      tree(node.children, `${prefix}${isLast ? '   ' : '|  '}`);
    });
  };
  const section = (label: string, nodes?: TaskDependencyQueryNode[]) => {
    if (!nodes) return;
    if (nodes.length === 0) {
      lines.push(`${label}: none`);
      return;
    }
    lines.push(`${label}:`);
    tree(nodes, '');
  };

  section('Blockers', query.blockers);
  section('Dependents', query.dependents);
  if (query.truncated) {
    lines.push(
      `Stopped at --depth ${query.depth}; some branches continue past it.`,
    );
  }
  return lines;
}

// A file whose frontmatter does not parse has no status, title, or position,
// so no filter can include or exclude it. List and search print it beside the
// tasks rather than only in the trailing warnings, which is easy to miss.
function formatUnreadableFile(file: UnreadableTaskFile): string {
  return `[unreadable] ${file.path}: ${file.reason} (${file.slug})`;
}

function unreadableFileJson(file: UnreadableTaskFile, includeBody: boolean) {
  return {
    slug: file.slug,
    path: file.path,
    reason: file.reason,
    ...(includeBody ? { content: file.content } : {}),
  };
}

/** Registers `task get`, which `--help` lists apart from the other queries. */
export function registerTaskGet(task: Command, ctx: CommandContext): void {
  const { adapter, data, output } = ctx;

  const getTaskCommand = task
    .command('get <slug>')
    .alias('show')
    .description('Retrieve one task as JSON')
    .option('--archived', 'Retrieve the task from the archive instead')
    // `get` has no text form. The flag is accepted because every other task
    // command takes it, and an agent that guesses it should not be refused.
    .option(
      '--json',
      'Accepted for consistency; the output is JSON either way',
    );

  getTaskCommand.action(async (slug: string, raw) => {
    const config = await ctx.loadConfig();
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

    // A single-task read is the narrowest one agents are told to prefer, so it
    // is the one that must not stay quiet about an unreadable Updates section.
    const updatesWarning = unreadableUpdatesWarning(found);
    if (updatesWarning) {
      output.warning(`${found.slug}: ${updatesWarning.message}`);
    }

    data(
      JSON.stringify(
        {
          ...taskJson(found),
          ...(found.unreadableUpdates
            ? { unreadable_updates: found.unreadableUpdates }
            : {}),
        },
        null,
        2,
      ),
    );
  });
}

/** Registers `task list`, `task search`, and `task graph`. */
export function registerTaskQueries(task: Command, ctx: CommandContext): void {
  const { adapter, data, chrome, isInteractive } = ctx;

  const listCommand = task
    .command('list')
    .description('List live tasks in board order, optionally filtered');
  listCommand
    .addOption(
      new Option(
        '-s, --status <statuses>',
        'Filter by status (comma-separated or repeatable; matches any)',
      ).argParser(accumulateCommaList),
    )
    .addOption(
      new Option(
        '-a, --assignee <assignees>',
        'Filter by assignee (comma-separated or repeatable; matches any)',
      ).argParser(accumulateCommaList),
    )
    .addOption(
      new Option(
        '-p, --priority <priorities>',
        'Filter by priority (comma-separated or repeatable; matches any)',
      ).argParser(accumulateCommaList),
    )
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

      const config = await ctx.loadConfig();
      const filters = resolveTaskFilters(listCommand, raw, config);
      const availabilityStatus =
        filters.statuses.length > 0 ? filters.statuses : undefined;
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
              status: availabilityStatus,
              archivedTasks: archived?.tasks,
              archivedSlugs: archived ? taskFileSlugs(archived) : undefined,
            })
          : listBlockedTasks(candidates, config, {
              status: availabilityStatus,
              archivedTasks: archived?.tasks,
              archivedSlugs: archived ? taskFileSlugs(archived) : undefined,
            });
      }

      const filtered = candidates
        .filter(t =>
          taskMatchesFilters(t, filters, {
            ignoreStatus: Boolean(raw.available || raw.blocked),
          }),
        )
        .slice(0, raw.limit);

      if (raw.json) {
        // An association is visible from either side, so resolving it needs
        // the live tasks even when this read is of the archive.
        const relatedOf = createRelatedIndex(
          raw.archived
            ? {
                tasks: (await listTasks(adapter, config)).tasks,
                archivedTasks: result.tasks,
                archivedSlugs: taskFileSlugs(result),
              }
            : {
                tasks: result.tasks,
                archivedTasks: archived?.tasks,
                archivedSlugs: result.archivedSlugs,
              },
        );
        const tasks = filtered.map(t => ({
          slug: t.slug,
          ...t.frontmatter,
          depends_on: t.frontmatter.depends_on ?? [],
          related: t.frontmatter.related ?? [],
          related_tasks: relatedOf(t),
          ...(boardOrder ? { position: boardOrder.positions.get(t.slug) } : {}),
          ...(raw.includeBody
            ? {
                body: t.body,
                comments: t.comments,
                ...(t.unreadableUpdates
                  ? { unreadable_updates: t.unreadableUpdates }
                  : {}),
              }
            : {}),
        }));
        const unreadable = result.unreadable.map(file =>
          unreadableFileJson(file, Boolean(raw.includeBody)),
        );
        const payload = raw.archived
          ? { archived: true, tasks, unreadable, warnings: result.warnings }
          : { tasks, unreadable, warnings: result.warnings };
        data(JSON.stringify(payload, null, 2));
        return;
      }

      if (raw.archived) data('Archived tasks:');
      for (const t of filtered) {
        data(
          `[${t.frontmatter.status}] ${t.frontmatter.title} (${t.slug})${flagSuffix(t)}`,
        );
      }
      for (const file of result.unreadable) data(formatUnreadableFile(file));
      if (result.warnings.length > 0) {
        chrome('');
        chrome('Warnings:');
        for (const w of result.warnings) {
          chrome(`  ${w.slug}: ${w.message}`);
        }
      }
    });

  const searchCommand = task
    .command('search <query>')
    .description(
      'Search task titles, tags, Markdown descriptions, and Task Updates',
    );
  searchCommand
    .addOption(
      new Option(
        '-s, --status <statuses>',
        'Filter by status (comma-separated or repeatable; matches any)',
      ).argParser(accumulateCommaList),
    )
    .addOption(
      new Option(
        '-a, --assignee <assignees>',
        'Filter by assignee (comma-separated or repeatable; matches any)',
      ).argParser(accumulateCommaList),
    )
    .addOption(
      new Option(
        '-p, --priority <priorities>',
        'Filter by priority (comma-separated or repeatable; matches any)',
      ).argParser(accumulateCommaList),
    )
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
    .addOption(
      new Option(
        '--available',
        'Restrict to tasks whose dependencies are satisfied (ranked like `task list`, live tasks only)',
      ).conflicts('blocked'),
    )
    .addOption(
      new Option(
        '--blocked',
        'Restrict to tasks with unsatisfied dependencies (live tasks only)',
      ).conflicts('available'),
    )
    .option(
      '--whole-word',
      'Match each term on word boundaries instead of as a substring',
    )
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
    .option(
      '--include-body',
      'Include full descriptions and Task Updates in JSON output',
    )
    .action(async (query: string, raw) => {
      if (!query.trim()) {
        throw new InvalidArgumentError('Search query must not be blank.');
      }
      if ((raw.available || raw.blocked) && (raw.archived || raw.all)) {
        throw new InvalidArgumentError(
          '--available and --blocked cannot be used with --archived or --all.',
        );
      }

      const config = await ctx.loadConfig();
      const filters = resolveTaskFilters(searchCommand, raw, config);
      const availabilityStatus =
        filters.statuses.length > 0 ? filters.statuses : undefined;
      const searchArchive = Boolean(raw.archived || raw.all);
      const searchLive = !raw.archived || Boolean(raw.all);
      // Availability resolves an archived dependency as satisfied, so the
      // archive is read for the dependency index even when the search itself
      // stays on live tasks. Mirrors `task list --available` without `--archived`.
      const readArchive =
        searchArchive || Boolean(raw.available || raw.blocked);

      const liveResult = searchLive
        ? await listTasks(adapter, config)
        : undefined;
      const archivedResult = readArchive
        ? await listArchivedTasks(adapter, config)
        : undefined;
      let candidates = [
        ...(liveResult?.tasks ?? []),
        ...(searchArchive ? (archivedResult?.tasks ?? []) : []),
      ];

      if (raw.available || raw.blocked) {
        const select = raw.available ? listAvailableTasks : listBlockedTasks;
        const eligible = new Set(
          select(candidates, config, {
            status: availabilityStatus,
            archivedTasks: archivedResult?.tasks,
            archivedSlugs: archivedResult
              ? taskFileSlugs(archivedResult)
              : undefined,
          }).map(task => task.slug),
        );
        candidates = candidates.filter(task => eligible.has(task.slug));
      }

      candidates = candidates.filter(task =>
        taskMatchesFilters(task, filters, {
          ignoreStatus: Boolean(raw.available || raw.blocked),
        }),
      );

      const archivedSlugs = new Set(
        (searchArchive ? (archivedResult?.tasks ?? []) : []).map(
          candidate => candidate.slug,
        ),
      );
      const locationOf = (slug: string): 'live' | 'archive' =>
        archivedSlugs.has(slug) ? 'archive' : 'live';
      const allMatches = searchTasks(candidates, query, {
        wholeWord: Boolean(raw.wholeWord),
      });
      const matches = allMatches.slice(0, raw.limit);
      const candidatesBySlug = new Map(
        candidates.map(candidate => [candidate.slug, candidate]),
      );
      const warnings = [
        ...(liveResult?.warnings ?? []),
        ...(searchArchive ? (archivedResult?.warnings ?? []) : []),
      ];
      const unreadable = [
        ...(liveResult?.unreadable ?? []),
        ...(searchArchive ? (archivedResult?.unreadable ?? []) : []),
      ];

      if (raw.json) {
        // Resolving an association needs both sides loaded, whichever set the
        // search itself ran over.
        const relatedLive = liveResult ?? (await listTasks(adapter, config));
        const relatedArchive =
          archivedResult ?? (await listArchivedTasks(adapter, config));
        const relatedOf = createRelatedIndex({
          tasks: relatedLive.tasks,
          archivedTasks: relatedArchive.tasks,
          archivedSlugs: taskFileSlugs(relatedArchive),
        });
        const payloadMatches = matches.map(match => {
          const source = candidatesBySlug.get(match.slug);
          return {
            slug: match.slug,
            title: match.title,
            status: match.status,
            location: locationOf(match.slug),
            matched_fields: match.matched_fields,
            related_tasks: source ? relatedOf(source) : [],
            ...(source && isTaskFlagged(source)
              ? { flag: source.frontmatter.flag }
              : {}),
            ...(match.snippet !== undefined ? { snippet: match.snippet } : {}),
            ...(match.update_matches
              ? { update_matches: match.update_matches }
              : {}),
            ...(raw.includeBody
              ? {
                  body: source?.body ?? '',
                  comments: source?.comments ?? [],
                }
              : {}),
          };
        });
        data(
          JSON.stringify(
            {
              matches: payloadMatches,
              total_matches: allMatches.length,
              unreadable: unreadable.map(file =>
                unreadableFileJson(file, Boolean(raw.includeBody)),
              ),
              warnings,
            },
            null,
            2,
          ),
        );
        return;
      }

      const flagSuffixFor = (slug: string): string => {
        const source = candidatesBySlug.get(slug);
        return source ? flagSuffix(source) : '';
      };
      if (allMatches.length === 0) {
        data(`No matches for "${query.trim()}".`);
      } else {
        if (raw.archived && matches.length > 0) {
          data('Archived task matches:');
        }
        for (const match of matches) {
          data(
            `${match.title} (${match.slug}) [${locationOf(match.slug)} · ${match.status}] [${match.matched_fields.join(', ')}]${flagSuffixFor(match.slug)}`,
          );
          if (match.snippet) data(`  ${match.snippet}`);
          for (const updateMatch of match.update_matches ?? []) {
            data(
              'unreadable' in updateMatch
                ? `  ↳ update (unreadable): ${updateMatch.snippet}`
                : `  ↳ update ${updateMatch.index} (${updateMatch.timestamp}): ${updateMatch.snippet}`,
            );
          }
        }
        const omitted = allMatches.length - matches.length;
        if (omitted > 0) {
          data(
            `… ${omitted} of ${allMatches.length} ${allMatches.length === 1 ? 'match' : 'matches'} not shown (raise --limit)`,
          );
        }
      }
      for (const file of unreadable) data(formatUnreadableFile(file));
      if (warnings.length > 0) {
        chrome('');
        chrome('Warnings:');
        for (const warning of warnings) {
          chrome(`  ${warning.slug}: ${warning.message}`);
        }
      }
    });

  const graphCommand = task
    .command('graph [slug]')
    .description('Show the task dependency graph, or the chain around one task')
    .option('--archived', 'Include archived tasks as graph nodes')
    .option('--blockers', 'With a slug: walk only what the task depends on')
    .option('--dependents', 'With a slug: walk only what depends on the task')
    .option(
      '--depth <n>',
      'With a slug: levels to walk (1 lists direct neighbors only)',
      parsePositiveInteger,
    )
    .option('--json', 'Emit machine-readable JSON');

  graphCommand.action(async (slug: string | undefined, raw) => {
    const config = await ctx.loadConfig();
    if (slug === undefined) {
      if (raw.blockers || raw.dependents || raw.depth !== undefined) {
        graphCommand.error(
          '--blockers, --dependents, and --depth need a task slug.',
        );
        return;
      }
    }
    const liveResult = await listTasks(adapter, config);
    const archivedResult = raw.archived
      ? await listArchivedTasks(adapter, config)
      : undefined;

    if (slug !== undefined) {
      const query = queryTaskDependencies(slug, liveResult.tasks, config, {
        direction:
          raw.blockers && !raw.dependents
            ? 'blockers'
            : raw.dependents && !raw.blockers
              ? 'dependents'
              : 'both',
        depth: raw.depth,
        archivedTasks: archivedResult?.tasks,
        // Readiness matches `task list`: an archived dependency is
        // satisfied whether or not --archived walks into it.
        archivedSlugs: archivedResult
          ? taskFileSlugs(archivedResult)
          : liveResult.archivedSlugs,
        unreadableSlugs: liveResult.unreadable.map(file => file.slug),
      });
      if (!query) {
        if (!raw.archived && liveResult.archivedSlugs?.includes(slug)) {
          graphCommand.error(
            `Task '${slug}' is archived. Pass --archived to query it.`,
          );
        } else {
          graphCommand.error(`Task '${slug}' not found.`);
        }
        return;
      }
      if (raw.json || !isInteractive) {
        data(JSON.stringify(query, null, 2));
        return;
      }
      for (const line of formatTaskDependencyQuery(query)) data(line);
      return;
    }

    const graph = buildTaskDependencyGraph(liveResult.tasks, {
      archivedTasks: archivedResult?.tasks,
      archivedSlugs: archivedResult ? taskFileSlugs(archivedResult) : undefined,
    });

    if (raw.json || !isInteractive) {
      data(JSON.stringify(graph, null, 2));
      return;
    }

    for (const line of formatTaskDependencyGraph(graph)) data(line);
  });
}
