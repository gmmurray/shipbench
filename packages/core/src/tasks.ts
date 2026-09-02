import matter from 'gray-matter';
import { layoutAfterMove, layoutWithoutTask } from './layout.js';
import { resolveSlugCollision, slugify } from './slug.js';
import type {
  BoardLayout,
  ReadableStorageAdapter,
  ShipbenchConfig,
  StorageAdapter,
  Task,
  TaskComment,
  TaskFrontmatter,
  TaskReadResult,
  TaskValidationWarning,
} from './types.js';

const TASKS_DIR = '.shipbench/tasks';
const ARCHIVE_DIR = `${TASKS_DIR}/archive`;
const CONFIG_PATH = '.shipbench/config.json';
const LAYOUT_PATH = '.shipbench/layout.json';
const UPDATES_HEADING = '## Task Updates';
const ISO_8601_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
/** A column-0 ATX heading, captured as (marker, text). */
const ATX_HEADING = /^(#{1,6})\s+(.+?)\s*$/;
/**
 * Distinguishes an entry heading from a heading in an entry's prose.
 *
 * Only the `### <ISO 8601 timestamp>` form opens an entry, but a hand-written
 * one at the wrong level still needs to be caught rather than silently folded
 * into the previous entry. A leading calendar date is what separates the two:
 * an update writing about `#### 2026-01-04T09:00:00Z` meant a heading; one
 * writing `#### Rollback plan` meant prose.
 */
const ENTRY_HEADING_TEXT = /^\d{4}-\d{2}-\d{2}/;
const updatesParseWarnings = new WeakMap<Task, string>();
type Awaitable<T> = T | PromiseLike<T>;

export interface GetTaskOptions {
  archived?: boolean;
}

export interface ListTasksOptions {
  /** Already-read or concurrently-loading tasks from `tasks/archive/`. */
  archivedTasks?: Awaitable<readonly Task[]>;
  /** Archive file slugs, including files whose contents did not parse. */
  archivedSlugs?: Awaitable<Iterable<string>>;
}

export class ArchiveBlockedError extends Error {
  constructor(
    public readonly slug: string,
    public readonly dependentSlugs: string[],
  ) {
    super(
      `Cannot archive "${slug}" because live tasks depend on it: ${dependentSlugs.join(', ')}`,
    );
    this.name = 'ArchiveBlockedError';
  }
}

const KNOWN_FRONTMATTER_FIELDS = new Set<string>([
  'title',
  'status',
  'priority',
  'assignee',
  'tags',
  'depends_on',
  'created',
  'updated',
]);

function normalizeTimestamp(v: unknown): unknown {
  // js-yaml converts unquoted ISO timestamps into Date objects. The frontmatter
  // type promises strings, so coerce back.
  return v instanceof Date ? v.toISOString() : v;
}

interface ParsedTaskBody {
  body: string;
  comments: TaskComment[];
  warning?: string;
}

interface MarkdownFence {
  marker: '`' | '~';
  length: number;
}

function updateFence(
  line: string,
  current: MarkdownFence | null,
): MarkdownFence | null {
  const match = line.match(/^\s{0,3}(`{3,}|~{3,})/);
  if (!match) return current;

  const sequence = match[1]!;
  const marker = sequence[0] as MarkdownFence['marker'];
  if (!current) return { marker, length: sequence.length };
  if (current.marker === marker && sequence.length >= current.length)
    return null;
  return current;
}

function malformedUpdates(body: string, detail: string): ParsedTaskBody {
  return {
    body: body.trim(),
    comments: [],
    warning: `Malformed Updates section: ${detail} Raw Markdown was preserved in the task body.`,
  };
}

function parseTaskBody(rawBody: string): ParsedTaskBody {
  const body = rawBody.trim();
  if (!body) return { body: '', comments: [] };

  const lines = body.split(/\r?\n/);
  const updatesHeadings: number[] = [];
  let fence: MarkdownFence | null = null;

  for (const [index, line] of lines.entries()) {
    if (!fence && line.trimEnd() === UPDATES_HEADING) {
      updatesHeadings.push(index);
    }
    fence = updateFence(line, fence);
  }

  if (updatesHeadings.length === 0) return { body, comments: [] };
  if (updatesHeadings.length > 1) {
    return malformedUpdates(
      body,
      `found more than one "${UPDATES_HEADING}" heading.`,
    );
  }

  const updatesIndex = updatesHeadings[0]!;
  const description = lines.slice(0, updatesIndex).join('\n').trim();
  const updateLines = lines.slice(updatesIndex + 1);
  const comments: TaskComment[] = [];
  let timestamp: string | null = null;
  let textLines: string[] = [];
  fence = null;

  const finishComment = (): string | null => {
    if (timestamp === null) return null;
    const text = textLines.join('\n').trim();
    if (!text) return `entry "${timestamp}" has no text.`;
    comments.push({ timestamp, text });
    return null;
  };

  for (const line of updateLines) {
    const outsideFence = fence === null;
    const fenceOnLine = /^\s{0,3}(`{3,}|~{3,})/.test(line);

    if (outsideFence && !fenceOnLine) {
      const heading = line.match(ATX_HEADING);
      // Everything else a heading can say belongs to the entry's prose. Only a
      // heading that was reaching for a timestamp is judged as an entry heading.
      if (heading && ENTRY_HEADING_TEXT.test(heading[2]!)) {
        if (heading[1]!.length !== 3) {
          return malformedUpdates(
            body,
            `expected each entry heading to use "### <ISO 8601 timestamp>".`,
          );
        }

        const previousError = finishComment();
        if (previousError) return malformedUpdates(body, previousError);

        const nextTimestamp = heading[2]!;
        if (
          !ISO_8601_TIMESTAMP.test(nextTimestamp) ||
          Number.isNaN(Date.parse(nextTimestamp))
        ) {
          return malformedUpdates(
            body,
            `"${nextTimestamp}" is not an ISO 8601 timestamp.`,
          );
        }
        timestamp = nextTimestamp;
        textLines = [];
        continue;
      }
    }

    if (timestamp === null) {
      if (line.trim()) {
        return malformedUpdates(
          body,
          `expected "### <ISO 8601 timestamp>" before entry text.`,
        );
      }
    } else {
      textLines.push(line);
    }
    fence = updateFence(line, fence);
  }

  if (fence) {
    return malformedUpdates(body, 'an entry contains an unclosed code fence.');
  }

  const finalError = finishComment();
  if (finalError) return malformedUpdates(body, finalError);
  if (comments.length === 0) {
    return malformedUpdates(body, 'the section contains no entries.');
  }

  return { body: description, comments };
}

/**
 * Rejects a description the next read would mis-file.
 *
 * `serializeTask` writes `task.body` verbatim above the Updates section, and
 * the next `parseTaskBody` splits at the first unfenced `## Task Updates`
 * heading. Two descriptions break that split:
 *
 * - One carrying the marker itself either turns part of itself into comments or
 *   reads back as a malformed Updates section.
 * - One leaving a code fence open swallows the real marker below it, so every
 *   entry silently disappears from `task get`, the board, and search while
 *   still sitting in the file.
 *
 * Neither is recoverable by the caller, so refuse the write instead. Fenced
 * occurrences of the marker are safe — the parser ignores those too.
 */
function assertBodyWithoutUpdatesMarker(body: string): void {
  let fence: MarkdownFence | null = null;
  for (const line of body.split(/\r?\n/)) {
    if (!fence && line.trimEnd() === UPDATES_HEADING) {
      throw new Error(
        `Invalid task description: remove the "${UPDATES_HEADING}" heading — that section is written by \`task comment\`. Put the heading in a code fence if the description means it literally.`,
      );
    }
    fence = updateFence(line, fence);
  }
  if (fence) {
    throw new Error(
      'Invalid task description: close the code fence this description opens. An open fence runs past the end of the description and hides the Updates section from every read.',
    );
  }
}

/**
 * Rejects Updates entry text the next read would mis-file.
 *
 * `serializeTask` writes entry text verbatim under its `### <timestamp>`
 * heading, so text that reads as structure rather than prose writes cleanly and
 * then fails on the *next* read — and a task whose Updates section is malformed
 * refuses every `task comment` command, including the ones that would repair
 * it. Fail here, on the command that caused it, while the file is still good.
 *
 * The rules mirror the branches of `parseTaskBody`. A heading is prose unless it
 * reaches for a timestamp, which is why ordinary Markdown headings are fine in
 * an update.
 */
function assertCommentTextIsParsable(text: string): void {
  let fence: MarkdownFence | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (!fence) {
      if (line.trimEnd() === UPDATES_HEADING) {
        throw new Error(
          `Invalid task update: remove the "${UPDATES_HEADING}" heading — a second one would leave the section unreadable. Put it in a code fence if the update means it literally.`,
        );
      }
      const heading = line.match(ATX_HEADING);
      if (heading && ENTRY_HEADING_TEXT.test(heading[2]!)) {
        throw new Error(
          `Invalid task update: "${line.trim()}" reads as an entry heading and would split this update in two. Indent it, fence it, or drop the leading "#".`,
        );
      }
    }
    fence = updateFence(line, fence);
  }
  if (fence) {
    throw new Error(
      'Invalid task update: close the code fence this update opens. An open fence runs past the end of the update and swallows the entries below it.',
    );
  }
}

/**
 * `matter`, minus a cache that poisons itself.
 *
 * gray-matter memoizes by content, and it inserts the still-empty result into
 * that cache *before* parsing the front matter. A YAML error therefore leaves a
 * poisoned entry behind: parsing the same bytes again returns `{ data: {} }` and
 * succeeds, turning a loud failure into a task with no title and no status.
 *
 * A one-shot CLI command never notices — it parses each file once and exits.
 * Anything that re-reads does: a watcher firing twice on a file still being
 * written gets an error, then a phantom task whose `title` is `undefined`, which
 * is a crash in any consumer that measures it.
 */
function parseFrontmatter(fileContent: string) {
  try {
    return matter(fileContent);
  } catch (error) {
    // `clearCache` is in gray-matter's README but not in its own `.d.ts`.
    (matter as unknown as { clearCache(): void }).clearCache();
    throw error;
  }
}

function parseTaskFile(slug: string, fileContent: string): Task {
  const { data, content: bodyContent } = parseFrontmatter(fileContent);
  const parsedBody = parseTaskBody(bodyContent);
  const frontmatter = {
    ...data,
    created: normalizeTimestamp(data.created),
    updated: normalizeTimestamp(data.updated),
  } as TaskFrontmatter;
  const task: Task = {
    slug,
    frontmatter,
    body: parsedBody.body,
    comments: parsedBody.comments,
  };
  if (parsedBody.warning) {
    updatesParseWarnings.set(task, parsedBody.warning);
  }
  return task;
}

function stripUndefined<T extends object>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

function serializeTask(task: Task): string {
  const sections: string[] = [];
  if (task.body.trim()) sections.push(task.body.trim());

  if ((task.comments ?? []).length > 0) {
    const entries = task.comments
      .map(comment => `### ${comment.timestamp}\n${comment.text.trim()}`)
      .join('\n\n');
    sections.push(`${UPDATES_HEADING}\n\n${entries}`);
  }

  // gray-matter delegates to js-yaml, which throws on `undefined` values.
  // Cast to satisfy gray-matter's loose `object` typing.
  return matter.stringify(
    `\n${sections.join('\n\n')}\n`,
    stripUndefined(task.frontmatter) as unknown as Record<string, unknown>,
  );
}

function assertValidStatus(status: string, config: ShipbenchConfig): void {
  const valid = new Set(config.columns.map(c => c.id));
  if (!valid.has(status)) {
    throw new Error(
      `Invalid status "${status}". Valid: ${[...valid].join(', ')}`,
    );
  }
}

function assertValidPriority(priority: string, config: ShipbenchConfig): void {
  if (!config.priority.values.includes(priority)) {
    throw new Error(
      `Invalid priority "${priority}". Valid: ${config.priority.values.join(', ')}`,
    );
  }
}

/**
 * Normalizes a `depends_on` value to a deduped slug list. Absent, empty, and
 * all-blank values collapse to `undefined` so the field is omitted on write
 * rather than serialized as an empty array.
 */
function normalizeDependsOn(value: string[] | undefined): string[] | undefined {
  if (!value) return undefined;
  const deduped = [...new Set(value.map(s => s.trim()).filter(Boolean))];
  return deduped.length > 0 ? deduped : undefined;
}

/**
 * Write-time dependency validation. Rejects self-reference, slugs with no task
 * file, and direct two-hop cycles. Deeper cycles are intentionally not walked —
 * a future `shipbench task validate` owns full DAG checking.
 */
async function assertValidDependsOn(
  adapter: StorageAdapter,
  config: ShipbenchConfig,
  slug: string,
  dependsOn: string[] | undefined,
): Promise<void> {
  if (!dependsOn || dependsOn.length === 0) return;

  if (dependsOn.includes(slug)) {
    throw new Error(`Task "${slug}" cannot depend on itself.`);
  }

  const { tasks } = await listTasks(adapter, config);
  const bySlug = new Map(tasks.map(t => [t.slug, t]));

  for (const dep of dependsOn) {
    const target = bySlug.get(dep);
    if (!target) {
      throw new Error(
        `Unknown dependency "${dep}" — no task file matches that slug.`,
      );
    }
    if (target.frontmatter.depends_on?.includes(slug)) {
      throw new Error(
        `Dependency cycle: "${dep}" already depends on "${slug}".`,
      );
    }
  }
}

function validateTask(
  task: Task,
  config: ShipbenchConfig,
  knownSlugs: Set<string>,
): TaskValidationWarning[] {
  const warnings: TaskValidationWarning[] = [];
  const validStatuses = new Set(config.columns.map(c => c.id));
  const updatesWarning = updatesParseWarnings.get(task);

  if (updatesWarning) {
    warnings.push({
      slug: task.slug,
      field: 'updates',
      message: updatesWarning,
    });
  }

  if (!validStatuses.has(task.frontmatter.status)) {
    warnings.push({
      slug: task.slug,
      field: 'status',
      message: `Unknown status "${task.frontmatter.status}". Valid: ${[...validStatuses].join(', ')}`,
    });
  }

  if (
    task.frontmatter.priority &&
    !config.priority.values.includes(task.frontmatter.priority)
  ) {
    warnings.push({
      slug: task.slug,
      field: 'priority',
      message: `Unknown priority "${task.frontmatter.priority}". Valid: ${config.priority.values.join(', ')}`,
    });
  }

  const dependsOn = task.frontmatter.depends_on;
  if (dependsOn !== undefined && !Array.isArray(dependsOn)) {
    warnings.push({
      slug: task.slug,
      field: 'depends_on',
      message: 'Expected depends_on to be a list of task slugs.',
    });
  } else if (dependsOn) {
    // A dep target can be deleted after the dependent task was written, so
    // dangling slugs are a read-time warning rather than a load failure.
    for (const dep of dependsOn) {
      if (!knownSlugs.has(dep)) {
        warnings.push({
          slug: task.slug,
          field: 'depends_on',
          message: `Dangling dependency "${dep}" — no live task file matches that slug (it may be archived).`,
        });
      }
    }
  }

  for (const field of Object.keys(task.frontmatter)) {
    if (!KNOWN_FRONTMATTER_FIELDS.has(field)) {
      warnings.push({
        slug: task.slug,
        field,
        message: `Unknown frontmatter field "${field}" (preserved).`,
      });
    }
  }

  return warnings;
}

async function listTasksInDirectory(
  adapter: ReadableStorageAdapter,
  config: ShipbenchConfig,
  directory: string,
  additionalKnownSlugs: Awaitable<Iterable<string>> = [],
): Promise<TaskReadResult> {
  const files = await adapter.listFiles(directory);
  const mdFiles = files.filter(f => f.endsWith('.md'));

  if (mdFiles.length === 0) {
    return { tasks: [], warnings: [] };
  }

  const paths = mdFiles.map(f => `${directory}/${f}`);
  const contents = await adapter.readFiles(paths);

  const tasks: Task[] = [];
  const warnings: TaskValidationWarning[] = [];
  for (const [path, content] of contents) {
    const slug = path.replace(`${directory}/`, '').replace(/\.md$/, '');
    try {
      tasks.push(parseTaskFile(slug, content));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      warnings.push({
        slug,
        field: 'frontmatter',
        message: `Could not parse frontmatter in "${path}": ${detail}`,
      });
    }
  }

  // Validation runs in a second pass because `depends_on` warnings need the
  // full set of task-file slugs to spot dangling references. Include files
  // whose frontmatter could not be parsed: the dependency target still exists,
  // even though this read cannot return it as a valid Task.
  const knownSlugs = new Set([
    ...(await additionalKnownSlugs),
    ...mdFiles.map(file => file.replace(/\.md$/, '')),
  ]);
  for (const task of tasks) {
    warnings.push(...validateTask(task, config, knownSlugs));
  }

  return { tasks, warnings };
}

export async function listTasks(
  adapter: ReadableStorageAdapter,
  config: ShipbenchConfig,
  options: ListTasksOptions = {},
): Promise<TaskReadResult> {
  const archivedSlugs = Promise.all([
    Promise.resolve(options.archivedTasks ?? []),
    Promise.resolve(options.archivedSlugs ?? []),
  ]).then(([tasks, fileSlugs]) => [
    ...tasks.map(task => task.slug),
    ...fileSlugs,
  ]);
  return listTasksInDirectory(adapter, config, TASKS_DIR, archivedSlugs);
}

export async function getTask(
  adapter: ReadableStorageAdapter,
  config: ShipbenchConfig,
  slug: string,
  options: GetTaskOptions = {},
): Promise<Task | null> {
  // Keep config in the public signature alongside the other task read
  // primitives. Parsing itself is intentionally config-independent.
  void config;
  const directory = options.archived ? ARCHIVE_DIR : TASKS_DIR;
  const content = await adapter.readFileIfExists(`${directory}/${slug}.md`);
  return content === null ? null : parseTaskFile(slug, content);
}

export async function listArchivedTasks(
  adapter: ReadableStorageAdapter,
  config: ShipbenchConfig,
): Promise<TaskReadResult> {
  const liveFiles = await adapter.listFiles(TASKS_DIR);
  const liveSlugs = liveFiles
    .filter(file => file.endsWith('.md'))
    .map(file => file.replace(/\.md$/, ''));
  return listTasksInDirectory(adapter, config, ARCHIVE_DIR, liveSlugs);
}

/**
 * Returns every task-file slug represented by a read, including malformed files
 * that produced a warning instead of a Task.
 */
export function taskFileSlugs(result: TaskReadResult): string[] {
  return [
    ...new Set([
      ...result.tasks.map(task => task.slug),
      ...result.warnings.map(warning => warning.slug),
    ]),
  ];
}

export async function createTask(
  adapter: StorageAdapter,
  config: ShipbenchConfig,
  title: string,
  fields?: Partial<TaskFrontmatter>,
  body?: string,
): Promise<Task> {
  if (body !== undefined) assertBodyWithoutUpdatesMarker(body);

  const [existingFiles, archivedFiles] = await Promise.all([
    adapter.listFiles(TASKS_DIR),
    adapter.listFiles(ARCHIVE_DIR),
  ]);
  const existingSlugs = new Set(
    [...existingFiles, ...archivedFiles]
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace(/\.md$/, '')),
  );

  const baseSlug = slugify(title);
  if (!baseSlug) {
    throw new Error(
      'Task title must contain at least one slug-able character.',
    );
  }
  const slug = resolveSlugCollision(baseSlug, existingSlugs);
  const now = new Date().toISOString();

  const status = fields?.status ?? config.default_column;
  assertValidStatus(status, config);

  const priority = fields?.priority ?? config.priority.default;
  assertValidPriority(priority, config);

  const dependsOn = normalizeDependsOn(fields?.depends_on);
  await assertValidDependsOn(adapter, config, slug, dependsOn);

  const task: Task = {
    slug,
    frontmatter: {
      title,
      status,
      priority,
      assignee: fields?.assignee,
      tags: fields?.tags,
      depends_on: dependsOn,
      created: now,
      updated: now,
    },
    body: body ?? '',
    comments: [],
  };

  await adapter.writeFile(`${TASKS_DIR}/${slug}.md`, serializeTask(task));

  // Append the new slug to layout[status] so a task created in a regular
  // column has a stable position from the moment it exists. The done column
  // is time-sorted and deliberately has no persisted manual order.
  const currentLayout = config.layout ?? {};
  const columnOrder = currentLayout[status] ?? [];
  const nextLayout: BoardLayout =
    status === config.done_column
      ? currentLayout
      : {
          ...currentLayout,
          [status]: [...columnOrder, slug],
        };
  await writeLayout(adapter, config, nextLayout);

  return task;
}

export async function updateTask(
  adapter: StorageAdapter,
  config: ShipbenchConfig,
  slug: string,
  fields: Partial<TaskFrontmatter>,
  body?: string,
): Promise<{ task: Task; layout?: BoardLayout }> {
  if (body !== undefined) assertBodyWithoutUpdatesMarker(body);

  const path = `${TASKS_DIR}/${slug}.md`;
  const content = await adapter.readFile(path);
  const task = parseTaskFile(slug, content);

  if (fields.status) assertValidStatus(fields.status, config);
  if (fields.priority) assertValidPriority(fields.priority, config);

  // Distinguish "caller omitted depends_on" (leave as-is) from "caller passed
  // an empty list" (clear the field).
  const dependsOnProvided = 'depends_on' in fields;
  const dependsOn = dependsOnProvided
    ? normalizeDependsOn(fields.depends_on)
    : undefined;
  if (dependsOnProvided) {
    await assertValidDependsOn(adapter, config, slug, dependsOn);
  }

  const statusChanged =
    fields.status !== undefined && fields.status !== task.frontmatter.status;

  task.frontmatter = {
    ...task.frontmatter,
    ...fields,
    ...(dependsOnProvided ? { depends_on: dependsOn } : {}),
    // `created` is set once at creation and is not user-modifiable.
    created: task.frontmatter.created,
    updated: new Date().toISOString(),
  };

  if (body !== undefined) {
    task.body = body;
  }

  await adapter.writeFile(path, serializeTask(task));

  // A status change is a column move: maintain layout.json exactly as
  // reorderTask does. The task file is already written above, so we only
  // recompute/persist layout here — a single detail-panel edit that changes
  // status (with or without other fields) is one task write, not two.
  if (statusChanged) {
    const layout = await reorderLayout(
      adapter,
      config,
      slug,
      task.frontmatter.status,
      -1,
    );
    return { task, layout };
  }

  return { task };
}

export async function addComment(
  adapter: StorageAdapter,
  config: ShipbenchConfig,
  slug: string,
  text: string,
): Promise<Task> {
  void config;
  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new Error('Task update text must not be blank.');
  }
  assertCommentTextIsParsable(normalizedText);

  const path = `${TASKS_DIR}/${slug}.md`;
  const content = await adapter.readFile(path);
  const task = parseTaskFile(slug, content);
  if (updatesParseWarnings.has(task)) {
    throw new Error(
      `Cannot add an update to "${slug}" because its Updates section is malformed. Fix the section in the task file first.`,
    );
  }

  const now = new Date().toISOString();
  task.comments.push({ timestamp: now, text: normalizedText });
  task.frontmatter.updated = now;
  await adapter.writeFile(path, serializeTask(task));
  return task;
}

function assertMutableComments(
  task: Task,
  slug: string,
  action: 'edit' | 'delete',
): void {
  if (updatesParseWarnings.has(task)) {
    throw new Error(
      `Cannot ${action} an update on "${slug}" because its Updates section is malformed. Fix the section in the task file first.`,
    );
  }
}

function assertCommentIndex(task: Task, slug: string, index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= task.comments.length) {
    const expected =
      task.comments.length === 0
        ? 'the task has no Updates entries'
        : `expected a zero-based index from 0 to ${task.comments.length - 1}`;
    throw new Error(
      `Invalid task update index ${index} for "${slug}": ${expected}.`,
    );
  }
}

export async function editComment(
  adapter: StorageAdapter,
  config: ShipbenchConfig,
  slug: string,
  index: number,
  text: string,
): Promise<Task> {
  void config;
  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new Error('Task update text must not be blank.');
  }
  assertCommentTextIsParsable(normalizedText);

  const path = `${TASKS_DIR}/${slug}.md`;
  const content = await adapter.readFile(path);
  const task = parseTaskFile(slug, content);
  assertMutableComments(task, slug, 'edit');
  assertCommentIndex(task, slug, index);

  const comment = task.comments[index]!;
  task.comments[index] = { ...comment, text: normalizedText };
  task.frontmatter.updated = new Date().toISOString();
  await adapter.writeFile(path, serializeTask(task));
  return task;
}

export async function deleteComment(
  adapter: StorageAdapter,
  config: ShipbenchConfig,
  slug: string,
  index: number,
): Promise<Task> {
  void config;
  const path = `${TASKS_DIR}/${slug}.md`;
  const content = await adapter.readFile(path);
  const task = parseTaskFile(slug, content);
  assertMutableComments(task, slug, 'delete');
  assertCommentIndex(task, slug, index);

  task.comments.splice(index, 1);
  task.frontmatter.updated = new Date().toISOString();
  await adapter.writeFile(path, serializeTask(task));
  return task;
}

async function listExistingSlugs(
  adapter: StorageAdapter,
): Promise<Set<string>> {
  const files = await adapter.listFiles(TASKS_DIR);
  return new Set(
    files.filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, '')),
  );
}

function layoutWithoutDoneColumn(
  layout: BoardLayout,
  doneColumn: string,
): BoardLayout {
  const next = { ...layout };
  delete next[doneColumn];
  return next;
}

async function writeLayout(
  adapter: StorageAdapter,
  config: ShipbenchConfig,
  layout: BoardLayout,
): Promise<BoardLayout> {
  const persistedLayout = layoutWithoutDoneColumn(layout, config.done_column);
  const serializedLayout = `${JSON.stringify(persistedLayout, null, 2)}\n`;
  const rawConfig = await adapter.readFile(CONFIG_PATH);
  const userConfig = JSON.parse(rawConfig) as Record<string, unknown>;

  if (Object.hasOwn(userConfig, 'layout')) {
    delete userConfig.layout;
    await adapter.writeFiles(
      new Map([
        [LAYOUT_PATH, serializedLayout],
        [CONFIG_PATH, `${JSON.stringify(userConfig, null, 2)}\n`],
      ]),
    );
  } else {
    await adapter.writeFile(LAYOUT_PATH, serializedLayout);
  }
  return persistedLayout;
}

/**
 * Move a task to a (possibly different) column and position. `position` is a
 * 0-based index into the destination column's `layout` entry; `-1` appends.
 * Writes the task file only when status changes; always writes layout.json
 * with the updated order. Returns both the (possibly status-changed) task
 * and the authoritative new layout so callers can reconcile.
 */
export async function reorderTask(
  adapter: StorageAdapter,
  config: ShipbenchConfig,
  slug: string,
  toStatus: string,
  position: number,
): Promise<{ task: Task; layout: BoardLayout }> {
  assertValidStatus(toStatus, config);

  const path = `${TASKS_DIR}/${slug}.md`;
  const content = await adapter.readFile(path);
  const task = parseTaskFile(slug, content);

  if (task.frontmatter.status !== toStatus) {
    task.frontmatter = {
      ...task.frontmatter,
      status: toStatus,
      updated: new Date().toISOString(),
    };
    await adapter.writeFile(path, serializeTask(task));
  }

  const layout = await reorderLayout(adapter, config, slug, toStatus, position);
  return { task, layout };
}

// Recompute and persist layout.json for `slug` now sitting in `toStatus`,
// placing it at `position` (`-1` appends). The task file itself must already be
// written — this only touches layout. Shared by reorderTask (drag/move) and
// updateTask (a status change is a column move too).
async function reorderLayout(
  adapter: StorageAdapter,
  config: ShipbenchConfig,
  slug: string,
  toStatus: string,
  position: number,
): Promise<BoardLayout> {
  // Load all tasks so we can materialize any "leftovers" (tasks whose status
  // matches the destination column but whose slug isn't yet in
  // layout[toStatus]) into the layout before applying `position`. Callers
  // compute `position` against the *visible* column (layout order + leftovers
  // by created desc), so the layout array must be a superset of the visible
  // column for the position to line up. This also self-heals stale layouts
  // over time.
  const { tasks: allTasks } = await listTasks(adapter, config);

  return writeLayout(
    adapter,
    config,
    layoutAfterMove({
      layout: config.layout ?? {},
      tasks: allTasks,
      slug,
      toStatus,
      position,
      doneColumn: config.done_column,
    }),
  );
}

export async function moveTask(
  adapter: StorageAdapter,
  config: ShipbenchConfig,
  slug: string,
  toStatus: string,
): Promise<Task> {
  const { task } = await reorderTask(adapter, config, slug, toStatus, -1);
  return task;
}

export async function deleteTask(
  adapter: StorageAdapter,
  config: ShipbenchConfig,
  slug: string,
): Promise<void> {
  await adapter.deleteFile(`${TASKS_DIR}/${slug}.md`);
  const existingSlugs = await listExistingSlugs(adapter);
  const layout = layoutWithoutTask(config.layout ?? {}, slug, existingSlugs);
  await writeLayout(adapter, config, layout);
}

export async function archiveTask(
  adapter: StorageAdapter,
  config: ShipbenchConfig,
  slug: string,
  options?: { force?: boolean },
): Promise<Task> {
  const livePath = `${TASKS_DIR}/${slug}.md`;
  const content = await adapter.readFile(livePath);
  const task = parseTaskFile(slug, content);

  if (task.frontmatter.status !== config.done_column && !options?.force) {
    const { tasks } = await listTasks(adapter, config);
    const dependentSlugs = tasks
      .filter(
        candidate =>
          candidate.slug !== slug &&
          candidate.frontmatter.depends_on?.includes(slug),
      )
      .map(candidate => candidate.slug)
      .sort();

    if (dependentSlugs.length > 0) {
      throw new ArchiveBlockedError(slug, dependentSlugs);
    }
  }

  await adapter.writeFile(`${ARCHIVE_DIR}/${slug}.md`, content);
  await adapter.deleteFile(livePath);

  const existingSlugs = await listExistingSlugs(adapter);
  const layout = layoutWithoutTask(config.layout ?? {}, slug, existingSlugs);
  const currentPersistedLayout = layoutWithoutDoneColumn(
    config.layout ?? {},
    config.done_column,
  );
  if (JSON.stringify(layout) !== JSON.stringify(currentPersistedLayout)) {
    await writeLayout(adapter, config, layout);
  }

  return task;
}

export async function unarchiveTask(
  adapter: StorageAdapter,
  config: ShipbenchConfig,
  slug: string,
): Promise<Task> {
  const archivedPath = `${ARCHIVE_DIR}/${slug}.md`;
  const content = await adapter.readFile(archivedPath);
  const task = parseTaskFile(slug, content);

  await adapter.writeFile(`${TASKS_DIR}/${slug}.md`, content);
  await adapter.deleteFile(archivedPath);

  const status = task.frontmatter.status;
  if (status !== config.done_column) {
    const existingSlugs = await listExistingSlugs(adapter);
    const currentLayout = layoutWithoutTask(
      config.layout ?? {},
      slug,
      existingSlugs,
    );
    const nextLayout: BoardLayout = {
      ...currentLayout,
      [status]: [...(currentLayout[status] ?? []), slug],
    };
    await writeLayout(adapter, config, nextLayout);
  }

  return task;
}
