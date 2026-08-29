# Contributing to the ShipBench CLI

Development notes for working on this package. The published README is
user-facing; this file holds the things only a contributor needs.

## Layout

```
src/
  cli.ts                       # command definitions and core orchestration
  harborConnect.ts             # signed-URL, Git, warning, and HTTP preflight
  cli.test.ts                  # in-memory command tests
  cli.git.integration.test.ts  # temporary-repository Git integration tests
  index.ts                     # process entry point and exit-code mapping
tsup.config.ts                 # bundle config (see "Build" below)
```

`cli.ts` exports `createCli`. `index.ts` wires it to the real filesystem. Most
tests inject an in-memory adapter and Git runner; focused integration tests use
temporary Git repositories.

## Development workflow

```pwsh
pnpm dev            # watch + rebuild on change
pnpm test           # one-shot
pnpm test:watch     # tdd loop
```

Tests run from `src/` via the workspace's source-export trick (see "How
`@shipbench/core` is resolved" below) — no build step required for tests.

## Build

```pwsh
pnpm build          # produces dist/index.js
```

Configured in [tsup.config.ts](./tsup.config.ts). Three non-obvious things:

1. **`noExternal: ['@shipbench/core']`** — bundles core into the CLI binary.
   Without this, the CLI dist would `import '@shipbench/core'` at runtime,
   which resolves to core's `src/index.ts` (since core's `exports` point at TS
   source during dev), and Node cannot load `.ts` files directly.
2. **`banner` injects `createRequire`** — `gray-matter` (transitive via core)
   is CJS and uses `require('fs')`. tsup's ESM bundle wraps those requires, but
   pure-ESM Node has no `require` global. The banner creates one via
   `import { createRequire } from 'module'`.
3. **`define: { __SHIPBENCH_VERSION__: ... }`** — the version string in
   `cli.ts` is replaced at build time from `package.json`. **Bump the version in
   `package.json` and that is it** — there is no second place to update.

## Local install

```pwsh
pnpm build
pnpm link --global   # makes `shipbench` available everywhere
```

Requires `pnpm setup` to have created a global bin dir (one-time; restart the
shell afterwards).

## How `@shipbench/core` is resolved

Core's `package.json` `exports` point at `./src/index.ts` directly, not
`./dist/index.js`. This lets the CLI, tests, and Board import core without a
build step during development. The `publishConfig` block in core's
`package.json` swaps to `dist` paths when publishing.

The tradeoff: anything running the CLI as compiled JavaScript has to bundle
core (hence `noExternal`). If the CLI gains another workspace dependency, add
it to `noExternal` too.

## Source of truth for the version

`package.json#version`. The build inlines it into the bundle. Source and test
runs (no build) fall back to `'0.0.0-dev'`.

## Adding a new command

In [cli.ts](./src/cli.ts), inside `createCli`:

```ts
program
  .command('something <arg>')
  .description('What it does')
  .option('-f, --flag <value>', 'Description')
  .action(async (arg, raw) => {
    const config = await loadConfig(adapter);
    // ...do the thing, then:
    out('Done.');
  });
```

Then add a test in [cli.test.ts](./src/cli.test.ts) using the existing
`harness()` helper.
