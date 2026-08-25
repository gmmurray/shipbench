/**
 * The one place the terminal view touches storage. Read-only by type: the
 * adapter is held as `ReadableStorageAdapter`, so a write attempt is a compile
 * error rather than a code review catch.
 *
 * Whether a failure is fatal is not decided here — that is `run.ts`'s posture:
 * the first read may fail because there is nothing to show, and every read after
 * it keeps the last good frame instead.
 */

import {
  type ConfigLoadWarning,
  listArchivedTasks,
  listTasks,
  loadConfig,
  type ReadableStorageAdapter,
  type ShipbenchConfig,
  taskFileSlugs,
} from '@shipbench/core';
import { type BoardModel, buildBoardModel, type TuiFilters } from './model.js';
// The same spelling of the path the watcher arms itself with, so "where the
// config lives" has one answer in this package.
import { CONFIG_PATH } from './paths.js';

export type ReadOutcome =
  | { ok: true; model: BoardModel; config: ShipbenchConfig }
  | { ok: false; message: string };

/** Word-for-word what `startBoardServer` says, so both surfaces of `board` fail
 *  identically outside a project. */
export const MISSING_CONFIG_MESSAGE =
  'No .shipbench/config.json found. Run shipbench init first.';

/**
 * One line, always. Whatever comes back from here becomes `model.notice`, and
 * the notice is rendered onto the status line — a single row. Storage and
 * config errors may contain line breaks; letting one reach `paint` would shift
 * every row below it and leave the frame's row cache describing a screen that
 * no longer exists.
 */
function message(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * `loadConfig` deep-merges over DEFAULT_CONFIG and validates the resolved
 * config. Invalid layout metadata degrades to fallback order with a warning.
 */
export async function readBoard(
  adapter: ReadableStorageAdapter,
  filters: TuiFilters,
): Promise<ReadOutcome> {
  let config: ShipbenchConfig;
  const configWarnings: ConfigLoadWarning[] = [];
  try {
    if ((await adapter.readFileIfExists(CONFIG_PATH)) === null) {
      return { ok: false, message: MISSING_CONFIG_MESSAGE };
    }
    config = await loadConfig(adapter, {
      onWarning: warning => {
        configWarnings.push(warning);
      },
    });
  } catch (error) {
    return { ok: false, message: `config: ${message(error)}` };
  }

  try {
    // Read both collections on every refresh. The project watcher already covers
    // `tasks/archive/` recursively, so a cache would add invalidation state
    // without reducing idle work. Pass the in-flight archive read to live
    // validation so both collections keep loading in parallel while archived
    // dependencies are still distinguished from genuinely missing ones.
    const archivedPromise = listArchivedTasks(adapter, config);
    const livePromise = listTasks(adapter, config, {
      archivedTasks: archivedPromise.then(result => result.tasks),
      archivedSlugs: archivedPromise.then(taskFileSlugs),
    });
    const [live, archived] = await Promise.all([livePromise, archivedPromise]);
    const archivedSlugs = taskFileSlugs(archived);
    const dependencySlugs = new Set(
      live.tasks.flatMap(task =>
        Array.isArray(task.frontmatter.depends_on)
          ? task.frontmatter.depends_on
          : [],
      ),
    );
    const relevantArchiveWarnings = archived.warnings.filter(
      warning =>
        warning.field === 'frontmatter' && dependencySlugs.has(warning.slug),
    );
    const model = buildBoardModel(
      config,
      live.tasks,
      [...live.warnings, ...relevantArchiveWarnings],
      filters,
      archived.tasks,
      archivedSlugs,
    );
    const configWarning = configWarnings[0];
    if (configWarning) {
      model.notice = `${configWarning.path}: ${configWarning.message}`;
    }
    return {
      ok: true,
      model,
      config,
    };
  } catch (error) {
    // Per-file parse failures are successful partial reads with warnings. This
    // branch is reserved for failures that prevent the task collection itself
    // from being read, such as an adapter error.
    return { ok: false, message: `tasks: ${message(error)}` };
  }
}
