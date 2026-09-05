// ── Storage Adapter ──────────────────────────────────────────────

/**
 * Read-only surface. Consumers that only display data (e.g. Harbor's
 * remote board mode) hold this type so the compiler prevents accidental
 * write attempts.
 */
export interface ReadableStorageAdapter {
  readFile(path: string): Promise<string>;
  readFileIfExists(path: string): Promise<string | null>;
  listFiles(directory: string): Promise<string[]>;
  readFiles(paths: string[]): Promise<Map<string, string>>;
}

/**
 * Full read/write surface. Used by anything that mutates the `.shipbench/`
 * directory — the CLI and in-repo agents.
 */
export interface StorageAdapter extends ReadableStorageAdapter {
  writeFile(path: string, content: string): Promise<void>;
  writeFiles(files: Map<string, string>): Promise<void>;
  deleteFile(path: string): Promise<void>;
}

// ── Config ──────────────────────────────────────────────────────

export interface ColumnDef {
  id: string;
  label: string;
}

export interface PriorityConfig {
  values: string[];
  default: string;
}

/**
 * Per-column ordered list of task slugs. Tasks present in a column's array
 * render in that order; tasks whose slug isn't listed render below the
 * ordered set (sub-sorted by `created` desc for stable tiebreak). The
 * Uncategorized column ignores layout entirely.
 */
export type BoardLayout = Record<string, string[]>;

/**
 * Controls how the done column is rendered. Cap is applied only when no
 * search query is active — search always bypasses the cap so hidden matches
 * aren't invisible.
 */
export interface DoneDisplayConfig {
  /**
   * Max number of done tasks shown by default. `0` or negative disables the
   * cap entirely (show all).
   */
  max: number;
}

export interface ShipbenchConfig {
  version: number;
  name: string;
  columns: ColumnDef[];
  default_column: string;
  done_column: string;
  done_display: DoneDisplayConfig;
  priority: PriorityConfig;
  schema: {
    custom_fields: Record<string, unknown>;
  };
  layout: BoardLayout;
}

/** A non-fatal problem encountered while resolving project configuration. */
export interface ConfigLoadWarning {
  path: string;
  message: string;
}

export interface LoadConfigOptions {
  /** Receives recoverable diagnostics without coupling core to an output stream. */
  onWarning?: (warning: ConfigLoadWarning) => void;
}

// ── Task ────────────────────────────────────────────────────────

export interface TaskFrontmatter {
  title: string;
  status: string;
  priority?: string;
  assignee?: string;
  tags?: string[];
  /**
   * Slugs of tasks that must be finished first. Data only — nothing in core
   * gates mutations or moves a task's column based on this. An absent field
   * and an empty array mean the same thing: no dependencies.
   */
  depends_on?: string[];
  created: string;
  updated: string;
}

export interface TaskComment {
  timestamp: string;
  text: string;
}

/**
 * A trailing Updates section that could not be parsed, kept verbatim.
 *
 * Present only when the section is malformed, and mutually exclusive with
 * parsed `comments`. Readers should treat `text` as opaque Markdown to display
 * or preserve, never as content to merge into the description — the whole point
 * of the field is that `body` stays the description it claims to be.
 */
export interface UnreadableUpdates {
  /** The section verbatim, starting at its `## Task Updates` line. */
  text: string;
  /** Why the parse failed, as one sentence naming what was expected. */
  reason: string;
}

export interface Task {
  slug: string;
  frontmatter: TaskFrontmatter;
  /** Timeless task description, excluding the reserved trailing Task Updates section. */
  body: string;
  /** Time-anchored entries parsed from the trailing `## Task Updates` section. */
  comments: TaskComment[];
  /**
   * The trailing Updates section, verbatim, when it could not be parsed.
   * `comments` is empty whenever this is set. Writes preserve it unchanged.
   */
  unreadableUpdates?: UnreadableUpdates;
}

export interface TaskValidationWarning {
  slug: string;
  field: string;
  message: string;
}

/** Diagnostics an initialization check can surface without rejecting a project. */
export type ProjectWarning = ConfigLoadWarning | TaskValidationWarning;

export interface TaskReadResult {
  tasks: Task[];
  warnings: TaskValidationWarning[];
}

// ── Board API (consumed by @shipbench/board) ────────────────────

export interface BoardAPI {
  /** When true, the Board hides create/edit/drag affordances and renders a viewing experience only. */
  readonly readOnly?: boolean;

  getConfig(): Promise<ShipbenchConfig>;
  listTasks(): Promise<TaskReadResult>;
  listArchivedTasks(): Promise<TaskReadResult>;
  createTask(title: string, fields?: Partial<TaskFrontmatter>): Promise<Task>;
  /**
   * Update a task's fields and/or body. When the update changes `status`, the
   * task moves columns, so implementations also maintain layout and return the
   * authoritative new `layout` (mirroring {@link BoardAPI.reorderTask}); `layout`
   * is omitted when the status did not change.
   */
  updateTask(
    slug: string,
    fields: Partial<TaskFrontmatter>,
    body?: string,
  ): Promise<{ task: Task; layout?: BoardLayout }>;
  /** Append a time-stamped entry to the task's trailing Task Updates section. */
  addComment(slug: string, text: string): Promise<Task>;
  /** Edit an entry's text by zero-based index while preserving its timestamp. */
  editComment(slug: string, index: number, text: string): Promise<Task>;
  /** Delete an entry by zero-based index. */
  deleteComment(slug: string, index: number): Promise<Task>;
  moveTask(slug: string, toStatus: string): Promise<Task>;
  /**
   * Move (and reorder) a task. `position` is a 0-based index into the
   * destination column's `layout` entry; `-1` means "append to end".
   * Implementations are expected to return both the (possibly status-changed)
   * task and the authoritative new layout so consumers can reconcile.
   */
  reorderTask(
    slug: string,
    toStatus: string,
    position: number,
  ): Promise<{ task: Task; layout: BoardLayout }>;
  archiveTask(slug: string, options?: { force?: boolean }): Promise<void>;
  unarchiveTask(slug: string): Promise<Task>;
  deleteTask(slug: string): Promise<void>;
  onTasksChanged?(callback: () => void): () => void;
  /**
   * Turn a repo-root-relative path (e.g. `docs/spec.md`) into a URL the host can
   * actually serve, so Markdown links to repo files in a task body resolve to
   * something real. Return `null` when the path has no reachable destination.
   *
   * Optional, like {@link BoardAPI.onTasksChanged}: hosts that cannot point at
   * repo files omit it, and the Board renders those links as plain, visible
   * paths rather than dead anchors.
   */
  resolveRepoLink?(repoRelativePath: string): string | null;
}
