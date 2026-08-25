// Types

// Adapters
export { FsAdapter } from './adapters/fs.js';
export { GitHubAdapter, GitHubApiError } from './adapters/github.js';
export type { TaskAvailabilityOptions } from './availability.js';
// Availability
export {
  listAvailableTasks,
  listBlockedTasks,
} from './availability.js';
export { loadConfig, validateConfig } from './config.js';
// Config
export { DEFAULT_CONFIG } from './defaults.js';
// Dependencies
export type {
  TaskDependencyGraph,
  TaskDependencyGraphNode,
  TaskDependencyGraphOptions,
  TaskDependencyIndex,
  TaskDependencyResolution,
} from './dependencies.js';
export {
  buildTaskDependencyGraph,
  createTaskDependencyIndex,
  dependencyStatus,
  resolveTaskDependency,
  taskDependenciesAreSatisfied,
} from './dependencies.js';
// GitHub URLs
export type { GithubRepositoryParts } from './github-url.js';
export {
  normalizeGithubRemoteUrl,
  normalizeGithubUrl,
  parseGithubRemoteUrl,
  parseGithubUrl,
} from './github-url.js';
// Init
export type {
  InitProjectOptions,
  InitProjectResult,
  ProjectInitializationState,
} from './init.js';
export {
  initProject,
  inspectProjectInitialization,
  ProjectInitializationError,
} from './init.js';
// Layout — the single definition of manual task ordering, shared by core's
// writes and the Board's optimistic updates.
export {
  byCreatedDesc,
  byUpdatedDesc,
  layoutAfterMove,
  layoutWithoutTask,
  orderedTasksForColumn,
} from './layout.js';

// Search
export type { TaskSearchField, TaskSearchMatch } from './search.js';
export { searchTasks } from './search.js';

// Slug
export { resolveSlugCollision, slugify } from './slug.js';
export type { GetTaskOptions, ListTasksOptions } from './tasks.js';
// Tasks
export {
  ArchiveBlockedError,
  addComment,
  archiveTask,
  createTask,
  deleteComment,
  deleteTask,
  editComment,
  getTask,
  listArchivedTasks,
  listTasks,
  moveTask,
  reorderTask,
  taskFileSlugs,
  unarchiveTask,
  updateTask,
} from './tasks.js';
export type {
  BoardAPI,
  BoardLayout,
  ColumnDef,
  ConfigLoadWarning,
  DoneDisplayConfig,
  LoadConfigOptions,
  PriorityConfig,
  ProjectWarning,
  ReadableStorageAdapter,
  ShipbenchConfig,
  StorageAdapter,
  Task,
  TaskComment,
  TaskFrontmatter,
  TaskReadResult,
  TaskValidationWarning,
} from './types.js';
