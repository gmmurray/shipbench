# shipbench (CLI)

Terminal interface to the ShipBench project system. Wraps `@shipbench/core` with [commander](https://github.com/tj/commander.js) and an `FsAdapter` rooted at the selected project directory.

## Layout

```
src/
  cli.ts                       # command definitions and core orchestration
  harborConnect.ts             # signed-URL, Git, warning, and HTTP preflight
  cli.test.ts                  # in-memory command tests
  cli.git.integration.test.ts  # temporary-repository Git integration tests
  index.ts                     # process entry point and exit-code mapping
tsup.config.ts # bundle config (see "Build" below)
```

`cli.ts` exports `createCli`. `index.ts` wires it to the real filesystem. Most
tests inject an in-memory adapter and Git runner; focused integration tests use
temporary Git repositories.

## Commands

| Command                         | Notes                                                   |
| ------------------------------- | ------------------------------------------------------- |
| `shipbench init`                | Create `.shipbench/` when absent; leave a valid existing project byte-for-byte unchanged. |
| `shipbench init --harbor=<url>` | Safely initialize, then connect the GitHub origin through a signed Harbor URL. |
| `shipbench connect --harbor=<url>` | Connect an existing ShipBench project without changing project files. |
| `shipbench task create <title>` | `--status`, `--priority`, `--assignee`, `--tags=a,b,c`, `--json` to print the created task (the only way to learn a collision-suffixed slug programmatically). |
| `shipbench task comment <slug> <text>` | Append a timestamped entry to the task's trailing `## Task Updates` section. |
| `shipbench task comment edit <slug> <index> <text>` | Edit an entry's text by zero-based index; keep its timestamp. |
| `shipbench task comment delete <slug> <index>` | Delete an entry by zero-based index. |
| `shipbench task move <slug>`    | `--to=<status>` picks the column; the mutually exclusive `--top`, `--bottom`, `--before=<slug>`, `--after=<slug>`, and `--position=<n>` pick the spot in it. With a placement flag `--to` defaults to the task's current column, so it also reorders in place. Placement cannot target the done column. |
| `shipbench task list`           | Live tasks follow board order; filters include `--status`, `--priority`, `--assignee`, and `--tag`; JSON includes column `position` and can use `--include-body`. |
| `shipbench task search <query>` | Case-insensitive title, tag, and body search; supports `--archived`, `--all`, `--limit`, and JSON output. |
| `shipbench task graph`          | Dependency adjacency as JSON when piped or with `--json`; interactive terminals get an ASCII summary. |
| `shipbench task delete <slug>`  |                                                         |
| `shipbench board`               | Stub — wires up once `@shipbench/board` lands.          |

## Global options

| Option | Notes |
| --- | --- |
| `-C <path>` | Run any command against `<path>` instead of the current directory. Relative paths resolve from the shell's current directory. |
| `-v, --version` | Print the CLI version. |
| `-h, --help` | Print root or command help. |

`-C` applies to every command, including `init`, `connect`, `task *`, and
`board`. The path must exist and be a directory. For `init`, the default project
name comes from the selected directory's basename.

Harbor connection commands must run at the Git worktree root. They validate
the signed URL, ShipBench project, and GitHub origin before sending one POST.
Uncommitted, untracked, unpushed, or no-upstream ShipBench state produces
warnings but does not block the connection.

Connection scripts can rely on these exit codes:

| Exit | Meaning |
| --- | --- |
| `0` | Harbor connected the repository or confirmed an idempotent replay. |
| `2` | Usage or a local precondition failed; Harbor received no POST. |
| `3` | Harbor definitively rejected the request. |
| `4` | The remote result is unknown; inspect Harbor before retrying. |

## Development workflow

```pwsh
# Watch + rebuild on change.
pnpm dev
```

Or link globally once and use the real `shipbench` command — see "Distribution" below.

## Testing

```pwsh
pnpm test          # one-shot
pnpm test:watch    # tdd loop
```

Tests run from `src/` via the workspace's source-export trick (see "How `@shipbench/core` is resolved" below) — no build step required for tests.

## Build

```pwsh
pnpm build         # produces dist/index.js
```

The build is configured in [tsup.config.ts](./tsup.config.ts). Three non-obvious things:

1. **`noExternal: ['@shipbench/core']`** — bundles core into the CLI binary. Without this, the CLI dist would `import '@shipbench/core'` at runtime, which resolves to core's `src/index.ts` (since core's `exports` point at TS source during dev), and Node can't load `.ts` files directly.
2. **`banner` injects `createRequire`** — `gray-matter` (transitive via core) is CJS and uses `require('fs')`. tsup's ESM bundle wraps those requires, but pure-ESM Node has no `require` global. The banner creates one via `import { createRequire } from 'module'`.
3. **`define: { __SHIPBENCH_VERSION__: ... }`** — the version string in `cli.ts` is replaced at build time from `package.json`. **Bump the version in `package.json` and that's it** — no second place to update.

## Distribution

```pwsh
pnpm build
pnpm link --global   # makes `shipbench` available everywhere
```

Requires `pnpm setup` to have created a global bin dir (one-time, restart shell after).

To publish to npm later, the package.json `bin` field already points at `./dist/index.js`.

## How `@shipbench/core` is resolved

Core's `package.json` `exports` point at `./src/index.ts` directly (not `./dist/index.js`). This lets the CLI, tests, board, and harbor all import core without a build step during dev. The `publishConfig` block in core's package.json swaps to `dist` paths when publishing.

The downside: anything that runs the CLI as compiled JavaScript needs to bundle core (hence `noExternal`). If we add more workspace packages that the CLI depends on, add them to `noExternal` too.

## Source of truth for the version

`package.json#version`. The build inlines it into the bundle. Source / test runs (no build) fall back to `'0.0.0-dev'`.

## Adding a new command

In [cli.ts](./src/cli.ts), inside `createCli`:

```ts
program
  .command("something <arg>")
  .description("What it does")
  .option("-f, --flag <value>", "Description")
  .action(async (arg, raw) => {
    const config = await loadConfig(adapter);
    // ...do the thing, then:
    out("Done.");
  });
```

Then add a test in [cli.test.ts](./src/cli.test.ts) using the existing `harness()` helper.
