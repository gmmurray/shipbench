/**
 * The `.shipbench/` file watcher, shared by the board server and the terminal
 * view.
 *
 * `startBoardServer` had this inline: chokidar over the tasks directory,
 * `config.json` and `layout.json`, filtered to `.md` plus those two files, with a
 * 150 ms debounce. The terminal view needs exactly the same set with no HTTP
 * server attached, and the drift precedent in
 * docs/audits/board-move-algorithm-audit.md is what a second hand-maintained copy
 * of a rule turns into.
 */

import { join } from 'node:path';
import type { FSWatcher } from 'chokidar';
import chokidar from 'chokidar';
import { CONFIG_PATH, LAYOUT_PATH } from './paths.js';

export const DEBOUNCE_MS = 150;

export interface ProjectWatcher {
  close(): Promise<void>;
}

/**
 * Async handlers are allowed and are never awaited — a watcher fires and forgets.
 * Saying so in the type is what lets a caller hand over its `refresh` directly
 * instead of wrapping it in `void`, and lets a stand-in watcher await the work a
 * change kicked off.
 */
export type ProjectChangeHandler = () => void | Promise<void>;

/** The factory's own shape, so a caller can accept a stand-in for it. */
export type WatchProject = (
  cwd: string,
  onChange: ProjectChangeHandler,
) => Promise<ProjectWatcher>;

export async function watchProject(
  cwd: string,
  onChange: ProjectChangeHandler,
  debounceMs = DEBOUNCE_MS,
): Promise<ProjectWatcher> {
  const tasksDir = join(cwd, '.shipbench', 'tasks');
  const configFile = join(cwd, CONFIG_PATH);
  const layoutFile = join(cwd, LAYOUT_PATH);

  const watcher: FSWatcher = chokidar.watch(
    [tasksDir, configFile, layoutFile],
    { ignoreInitial: true },
  );

  let debounce: NodeJS.Timeout | undefined;
  watcher.on('all', (_event, changedPath) => {
    if (
      changedPath !== configFile &&
      changedPath !== layoutFile &&
      !changedPath.endsWith('.md')
    ) {
      return;
    }
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => void onChange(), debounceMs);
  });

  await new Promise<void>((resolve, reject) => {
    watcher.once('ready', resolve);
    watcher.once('error', reject);
  });

  return {
    async close() {
      if (debounce) clearTimeout(debounce);
      await watcher.close();
    },
  };
}
