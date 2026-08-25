/**
 * Where the convention's machine-managed files live, relative to a project root.
 *
 * Their own module so the read path does not have to import the watcher — and
 * with it chokidar — to learn the spelling of a path. `board terminal` with
 * stdout redirected reads once and exits without ever watching anything.
 */

export const CONFIG_PATH = '.shipbench/config.json';
export const LAYOUT_PATH = '.shipbench/layout.json';
