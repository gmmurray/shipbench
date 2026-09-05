# ShipBench

**Plans that ship with the work.**

Git-native project management for solo developers. Your project plan lives inside your repository as plain Markdown, so Git, your editor, the ShipBench CLI, the local board, and your coding agents all work from one source of truth.

## Why

Every new repository starts with the same setup before a line of code exists: create a workspace, name the columns, wire up an integration. Most projects skip it, and the plan ends up in your head, in a chat log, or in a `TODO.md` that stopped reflecting reality a week ago.

That overhead used to be invisible. A team amortizes one workspace across a year and a dozen people. A solo developer working with AI has inverted the ratio: many projects, short cycles, one person. Hosted trackers are built to coordinate people you don't have, and todo lists sit in the right place but hold no state.

Your repository already contains your code, your documentation, and your architecture decisions. **ShipBench's premise is that your project plan belongs there too.**

The full argument is in [docs/why.md](docs/why.md).

## Quickstart

```bash
npm install --global shipbench

shipbench init                        # scaffold .shipbench/ in a Git repository
shipbench task create "Build the API" # create your first task
shipbench board                       # open the local Kanban board
```

No account, no API key, no service. See the [quickstart guide](https://shipbench.dev/docs/quickstart) for the full walkthrough.

## What's in the box

ShipBench is one portable system with several clients. The system works on its own; every client is optional.

- **The project system** — a `.shipbench/` directory of Markdown tasks with YAML frontmatter, governed by a local config. Any tool that can read a file can read the board. [Specification](https://shipbench.dev/docs/convention-spec).
- **ShipBench CLI** — create, query, move, and validate tasks from a terminal or a coding agent, and host the local board. [Reference](https://shipbench.dev/docs/cli-reference).
- **ShipBench Harbor** — the optional hosted client for shaping ideas before a repository exists and viewing public GitHub-backed boards read-only. Tasks never leave their repository. Not yet deployed; its page returns once it is.

## Repository layout

```
shipbench/
├── packages/
│   ├── core/     # @shipbench/core — headless library (parsing, validation, CRUD)
│   └── board/    # @shipbench/board — React kanban board app
└── apps/
    ├── cli/      # shipbench — the CLI
    └── site/     # shipbench.dev — Astro marketing site and docs
```

pnpm workspace monorepo, TypeScript strict, ESM only. No Turborepo — use `pnpm --filter` for targeted work.

```bash
pnpm install
pnpm --filter @shipbench/core build
pnpm typecheck
```

## Documentation

- [shipbench.dev/docs](https://shipbench.dev/docs) — published overview, quickstart, and reference.
- [docs/why.md](docs/why.md) — why ShipBench exists.
- [docs/spec.md](docs/spec.md) — the full product spec.
- [docs/design-doctrine.md](docs/design-doctrine.md) — the shared visual design doctrine.
- [AGENTS.md](AGENTS.md) — architecture, conventions, and instructions for coding agents working in this repository.

This repository uses its own [`.shipbench/`](.shipbench/) directory as its live project board.
