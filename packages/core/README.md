# @shipbench/core

The headless library behind [ShipBench](https://github.com/gmmurray/shipbench) —
Git-native project management where the task board lives in the repository as
plain Markdown.

This package parses, validates, and writes that board. It has **no filesystem
access, no UI, and no network calls of its own**: every read and write goes
through a `StorageAdapter` you supply, so the same logic runs against a local
checkout, the GitHub API, or an in-memory fixture in a test.

Most people want the [`shipbench` CLI](https://www.npmjs.com/package/shipbench)
instead. Use this package when you are building a tool on top of the
convention.

## Install

```bash
npm install @shipbench/core
```

## Usage

```ts
import { FsAdapter, loadConfig, listTasks, createTask } from '@shipbench/core';

const adapter = new FsAdapter(process.cwd());
const config = await loadConfig(adapter);

const { tasks, warnings } = await listTasks(adapter, config);

await createTask(adapter, config, {
  title: 'Build the API',
  priority: 'high',
  tags: ['backend'],
});
```

## Adapters

Two implementations ship with the package:

- **`FsAdapter`** — full read/write against the local filesystem.
- **`GitHubAdapter`** — reads `.shipbench/` through the GitHub Contents API.
  Cross-runtime, so it works in Node, browsers, and Cloudflare Workers.

The interface is deliberately small so additional hosts stay easy to add:

```ts
interface ReadableStorageAdapter {
  readFile(path: string): Promise<string>;
  readFileIfExists(path: string): Promise<string | null>;
  listFiles(directory: string): Promise<string[]>;
  readFiles(paths: string[]): Promise<Map<string, string>>;
}

interface StorageAdapter extends ReadableStorageAdapter {
  writeFile(path: string, content: string): Promise<void>;
  writeFiles(files: Map<string, string>): Promise<void>;
  deleteFile(path: string): Promise<void>;
}
```

Consumers that only display data should hold a `ReadableStorageAdapter` — it
turns an accidental write into a compile error.

## What it gives you

- **Tasks** — `createTask`, `getTask`, `updateTask`, `moveTask`, `reorderTask`,
  `deleteTask`, `listTasks`, `searchTasks`
- **Archiving** — `archiveTask`, `unarchiveTask`, `listArchivedTasks`
- **Dependencies** — `listAvailableTasks`, `listBlockedTasks`,
  `buildTaskDependencyGraph`
- **Comments** — `addComment`, `editComment`, `deleteComment`
- **Config and setup** — `loadConfig`, `validateConfig`, `initProject`,
  `DEFAULT_CONFIG`
- **Slugs** — `slugify`, `resolveSlugCollision`

## Design rules worth knowing

**Strict on write, graceful on read.** Invalid statuses and priorities are
rejected on write. On read, a task with an unrecognized status comes back with a
validation warning rather than being dropped — the board never silently loses
work.

**Unknown frontmatter is preserved.** Core passes through fields it does not own,
with a warning. It never strips data it did not write.

**Timestamps are managed for you.** `created` is set once; `updated` moves on
every mutation. Both ISO 8601.

**Partial configs are fine.** `config.json` is deep-merged over `DEFAULT_CONFIG`
at read time, so any field can be omitted.

## The `/layout` subpath

Manual task ordering is shared contract, not private logic — hosts running
optimistic updates must produce the same order core would write. It is exported
from a pure subpath that imports only types:

```ts
import { orderedTasksForColumn, layoutAfterMove } from '@shipbench/core/layout';
```

Import ordering helpers from `@shipbench/core/layout`, never the package root —
the root re-exports `FsAdapter`, which pulls in `node:fs` and will break a
browser bundle.

## License

MIT
