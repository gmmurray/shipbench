import { resolveConfig } from './config.js';
import { listArchivedTasks, listTasks } from './tasks.js';
import type {
  ConfigLoadWarning,
  ConfigWarningCode,
  ReadableStorageAdapter,
  ShipbenchConfig,
  Task,
  TaskValidationWarning,
  TaskWarningCode,
} from './types.js';

const CONFIG_PATH = '.shipbench/config.json';
const TASKS_DIR = '.shipbench/tasks';
const ARCHIVE_DIR = `${TASKS_DIR}/archive`;

/**
 * Every problem `validateProject` can report. Task and layout codes are the
 * read warnings' own codes; the rest are found only by a whole-project check.
 */
export type ProjectProblemCode =
  | TaskWarningCode
  | ConfigWarningCode
  | 'config-unparseable'
  | 'config-invalid'
  | 'config-field-unknown'
  | 'dependency-cycle'
  | 'slug-reused-in-archive'
  | 'file-ignored';

/**
 * `error`: the data is invalid, and something reading it misplaces, hides, or
 * permanently blocks a task. `warning`: the project reads correctly, but the
 * file holds something that was probably not meant.
 */
export type ProjectProblemSeverity = 'error' | 'warning';

export interface ProjectProblem {
  severity: ProjectProblemSeverity;
  code: ProjectProblemCode;
  /** The file to open, e.g. `.shipbench/tasks/<slug>.md`. */
  path: string;
  /** The task the problem is in, for problems in a task file. */
  slug?: string;
  /** The frontmatter field or config key at fault, when there is one. */
  field?: string;
  message: string;
  /** `dependency-cycle` only: the loop, starting and ending on the same slug. */
  cycle?: string[];
}

export interface ProjectValidationReport {
  /** True when no problem is an error. Warnings alone leave a project valid. */
  valid: boolean;
  errors: number;
  warnings: number;
  /**
   * What was inspected. `tasks` and `archived` count task files, readable or
   * not; `null` means that part was not checked — the archive because it was
   * not asked for, tasks because the config they are checked against is
   * itself invalid.
   */
  checked: {
    tasks: number | null;
    archived: number | null;
  };
  /** Ordered by file path, then as each file's checks found them. */
  problems: ProjectProblem[];
}

export interface ValidateProjectOptions {
  /** Also check the files in `tasks/archive/`. Off by default. */
  archived?: boolean;
}

const ERROR_CODES = new Set<ProjectProblemCode>([
  'config-unparseable',
  'config-invalid',
  'layout-unparseable',
  'frontmatter-unparseable',
  'updates-unreadable',
  'title-invalid',
  'status-unknown',
  'priority-unknown',
  'tags-invalid',
  'timestamp-invalid',
  'depends-on-invalid',
  'depends-on-self',
  'depends-on-dangling',
  'dependency-cycle',
  'related-invalid',
  'flag-invalid',
  'slug-reused-in-archive',
]);

function severityOf(code: ProjectProblemCode): ProjectProblemSeverity {
  return ERROR_CODES.has(code) ? 'error' : 'warning';
}

/** Keys core reads from config.json, one level deep. `layout` is the legacy location. */
const KNOWN_CONFIG_KEYS: Record<string, readonly string[] | null> = {
  version: null,
  name: null,
  columns: null,
  default_column: null,
  done_column: null,
  done_display: ['max'],
  priority: ['values', 'default'],
  schema: ['custom_fields'],
  layout: null,
};

function unknownConfigKeys(userConfig: object): string[] {
  const unknown: string[] = [];
  for (const [key, value] of Object.entries(userConfig)) {
    if (!Object.hasOwn(KNOWN_CONFIG_KEYS, key)) {
      unknown.push(key);
      continue;
    }
    const nested = KNOWN_CONFIG_KEYS[key];
    if (!nested || typeof value !== 'object' || value === null) continue;
    if (Array.isArray(value)) continue;
    for (const child of Object.keys(value)) {
      if (!nested.includes(child)) unknown.push(`${key}.${child}`);
    }
  }
  return unknown;
}

function configWarningProblem(warning: ConfigLoadWarning): ProjectProblem {
  const code = warning.code ?? 'layout-unparseable';
  return {
    severity: severityOf(code),
    code,
    path: warning.path,
    message: warning.message,
  };
}

function taskWarningProblem(
  warning: TaskValidationWarning,
  directory: string,
): ProjectProblem {
  const code = warning.code ?? 'field-unknown';
  return {
    severity: severityOf(code),
    code,
    path: `${directory}/${warning.slug}.md`,
    slug: warning.slug,
    field: warning.field,
    message: warning.message,
  };
}

function dependencyList(task: Task): string[] {
  const { depends_on: dependsOn } = task.frontmatter as {
    depends_on?: unknown;
  };
  if (!Array.isArray(dependsOn)) return [];
  return dependsOn.filter((slug): slug is string => typeof slug === 'string');
}

/**
 * Every dependency loop among live tasks, one per strongly connected group.
 *
 * Writes reject only a direct two-task cycle, so a longer one, or any cycle a
 * hand edit or merge introduced, is found here. A task depending on itself is
 * left to the read warning. Each loop is the shortest one through the group's
 * alphabetically first slug, which is enough to see which link to remove.
 */
function dependencyCycles(tasks: readonly Task[]): string[][] {
  const edges = new Map<string, string[]>();
  for (const task of tasks) edges.set(task.slug, []);
  for (const task of tasks) {
    edges.set(
      task.slug,
      [...new Set(dependencyList(task))].filter(
        slug => slug !== task.slug && edges.has(slug),
      ),
    );
  }

  // Tarjan's algorithm, iterative so a long chain cannot overflow the stack.
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const groups: string[][] = [];
  let next = 0;

  for (const root of [...edges.keys()].sort()) {
    if (index.has(root)) continue;
    const work: Array<{ slug: string; edge: number }> = [
      { slug: root, edge: 0 },
    ];
    index.set(root, next);
    low.set(root, next);
    next += 1;
    stack.push(root);
    onStack.add(root);

    while (work.length > 0) {
      const frame = work[work.length - 1]!;
      const targets = edges.get(frame.slug)!;
      if (frame.edge < targets.length) {
        const target = targets[frame.edge]!;
        frame.edge += 1;
        if (!index.has(target)) {
          index.set(target, next);
          low.set(target, next);
          next += 1;
          stack.push(target);
          onStack.add(target);
          work.push({ slug: target, edge: 0 });
        } else if (onStack.has(target)) {
          low.set(
            frame.slug,
            Math.min(low.get(frame.slug)!, index.get(target)!),
          );
        }
        continue;
      }

      work.pop();
      const parent = work[work.length - 1];
      if (parent) {
        low.set(
          parent.slug,
          Math.min(low.get(parent.slug)!, low.get(frame.slug)!),
        );
      }
      if (low.get(frame.slug) === index.get(frame.slug)) {
        const group: string[] = [];
        let member: string;
        do {
          member = stack.pop()!;
          onStack.delete(member);
          group.push(member);
        } while (member !== frame.slug);
        if (group.length > 1) groups.push(group);
      }
    }
  }

  return groups
    .map(group => {
      const members = new Set(group);
      const start = [...group].sort()[0]!;
      // Breadth-first from `start` inside the group, back to `start`.
      const previous = new Map<string, string>();
      const queue = [start];
      while (queue.length > 0) {
        const slug = queue.shift()!;
        for (const target of [...edges.get(slug)!].sort()) {
          if (!members.has(target)) continue;
          if (target === start) {
            const loop = [slug];
            for (let at = slug; at !== start; ) {
              at = previous.get(at)!;
              loop.unshift(at);
            }
            return [...loop, start];
          }
          if (!previous.has(target)) {
            previous.set(target, slug);
            queue.push(target);
          }
        }
      }
      return [...group, start];
    })
    .sort((a, b) => a[0]!.localeCompare(b[0]!));
}

/** Entries in a tasks directory that no read picks up as a task. */
function ignoredEntries(files: readonly string[], directory: string): string[] {
  return files
    .filter(
      file =>
        !file.endsWith('.md') &&
        !file.startsWith('.') &&
        !(directory === TASKS_DIR && file === 'archive'),
    )
    .sort()
    .map(file => `${directory}/${file}`);
}

/**
 * Checks a project's structure and returns every problem found, without
 * writing anything.
 *
 * It reuses the read path, so a problem it reports is one every host's reads
 * already tolerate or warn about. What it adds is what one read cannot see: a
 * dependency loop of any length, a slug used both live and in the archive, and
 * a file in `tasks/` that no read picks up. One unreadable task does not stop
 * the rest from being checked. An invalid config does, because statuses and
 * priorities are only valid relative to it.
 *
 * It establishes structure only. Whether a task is finished, or its reasoning
 * sound, is not something a file check can know.
 *
 * Throws only when `.shipbench/config.json` is missing, as `loadConfig` does.
 */
export async function validateProject(
  adapter: ReadableStorageAdapter,
  options: ValidateProjectOptions = {},
): Promise<ProjectValidationReport> {
  const problems: ProjectProblem[] = [];
  const configWarnings: ConfigLoadWarning[] = [];
  const resolution = await resolveConfig(adapter, {
    onWarning: warning => {
      configWarnings.push(warning);
    },
  });

  if (resolution.kind === 'unreadable') {
    // JSON.parse's messages end without a period, core's own with one.
    const reason = resolution.errors[0].message.trim().replace(/\.?$/, '.');
    problems.push({
      severity: 'error',
      code: 'config-unparseable',
      path: CONFIG_PATH,
      message: `${reason} Tasks were not checked, because their statuses and priorities are checked against this file.`,
    });
    return report(problems, { tasks: null, archived: null });
  }

  for (const key of unknownConfigKeys(resolution.userConfig)) {
    problems.push({
      severity: 'warning',
      code: 'config-field-unknown',
      path: CONFIG_PATH,
      field: key,
      message: `Unknown config key "${key}". Core ignores it; check the spelling if it was meant to change a setting.`,
    });
  }

  if (resolution.kind === 'invalid') {
    for (const error of resolution.errors) {
      problems.push({
        severity: 'error',
        code: 'config-invalid',
        path: CONFIG_PATH,
        message: error,
      });
    }
    problems.push(...configWarnings.map(configWarningProblem));
    return report(problems, { tasks: null, archived: null });
  }

  problems.push(...configWarnings.map(configWarningProblem));
  const config: ShipbenchConfig = resolution.config;

  const [liveFiles, archiveFiles] = await Promise.all([
    adapter.listFiles(TASKS_DIR),
    adapter.listFiles(ARCHIVE_DIR),
  ]);
  const archiveSlugs = archiveFiles
    .filter(file => file.endsWith('.md'))
    .map(file => file.replace(/\.md$/, ''));

  // Archive membership satisfies a dependency, so pass it in: without it, a
  // dependency on archived work would read as dangling.
  const live = await listTasks(adapter, config, {
    archivedSlugs: archiveSlugs,
  });
  const liveSlugs = new Set([
    ...live.tasks.map(task => task.slug),
    ...live.unreadable.map(file => file.slug),
  ]);
  const taskProblems: ProjectProblem[] = live.warnings.map(warning =>
    taskWarningProblem(warning, TASKS_DIR),
  );

  for (const slug of archiveSlugs) {
    if (!liveSlugs.has(slug)) continue;
    taskProblems.push({
      severity: 'error',
      code: 'slug-reused-in-archive',
      path: `${TASKS_DIR}/${slug}.md`,
      slug,
      message: `"${slug}" names both a live task and ${ARCHIVE_DIR}/${slug}.md. Archiving or unarchiving either one overwrites the other; give one of them a new slug.`,
    });
  }

  for (const cycle of dependencyCycles(live.tasks)) {
    taskProblems.push({
      severity: 'error',
      code: 'dependency-cycle',
      path: `${TASKS_DIR}/${cycle[0]}.md`,
      slug: cycle[0],
      field: 'depends_on',
      message: `Dependency cycle: ${cycle.join(' → ')}. None of these tasks can become available until one of them stops depending on the next.`,
      cycle,
    });
  }

  for (const path of ignoredEntries(liveFiles, TASKS_DIR)) {
    taskProblems.push({
      severity: 'warning',
      code: 'file-ignored',
      path,
      message:
        'Not a task file, so no read shows it. Task files end in `.md`; rename it if it was meant to be one.',
    });
  }

  let archivedCount: number | null = null;
  if (options.archived) {
    const archived = await listArchivedTasks(adapter, config);
    archivedCount = archived.tasks.length + archived.unreadable.length;
    taskProblems.push(
      ...archived.warnings.map(warning =>
        taskWarningProblem(warning, ARCHIVE_DIR),
      ),
    );
    for (const path of ignoredEntries(archiveFiles, ARCHIVE_DIR)) {
      taskProblems.push({
        severity: 'warning',
        code: 'file-ignored',
        path,
        message:
          'Not a task file, so no read shows it. Task files end in `.md`; rename it if it was meant to be one.',
      });
    }
  }

  // Stable sort: grouped by file, each file's problems in the order found.
  problems.push(
    ...taskProblems
      .map((problem, order) => ({ problem, order }))
      .sort(
        (a, b) =>
          a.problem.path.localeCompare(b.problem.path) || a.order - b.order,
      )
      .map(({ problem }) => problem),
  );

  return report(problems, {
    tasks: live.tasks.length + live.unreadable.length,
    archived: archivedCount,
  });
}

function report(
  problems: ProjectProblem[],
  checked: ProjectValidationReport['checked'],
): ProjectValidationReport {
  const errors = problems.filter(p => p.severity === 'error').length;
  return {
    valid: errors === 0,
    errors,
    warnings: problems.length - errors,
    checked,
    problems,
  };
}
