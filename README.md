# ShipBench

**Plans that ship with the work.**

Git-native project management for solo developers.

ShipBench keeps each task as a Markdown file in the repository it belongs to, inside a `.shipbench/` folder. The ShipBench CLI and a local board read and write those files, and so can your editor and your coding agents. There's no account and nothing to host.

## Why I built it

I keep several projects going at once, usually with AI agents doing part of the work, and nothing I tried for tracking them fit. Linear worked, but it's built for teams and took real setup for every repository. Task lists and spec documents in the repository were easy for agents to reach, but they were either too thin to hold a task's context or so long that nobody read them. One Markdown file per task, kept in the repository, turned out to be the right size. The longer version is at [shipbench.dev/docs/why](https://shipbench.dev/docs/why/).

— Greg ([thedevelopergreg.com](https://thedevelopergreg.com))

## Quickstart

```bash
npm install --global shipbench

shipbench init                        # scaffold .shipbench/ in a Git repository
shipbench task create "Build the API" # create your first task
shipbench board                       # open the local Kanban board
```

No account or API key needed. The [quickstart guide](https://shipbench.dev/docs/quickstart) walks through the rest.

## What's here

- **The convention.** A `.shipbench/` directory of Markdown tasks with YAML frontmatter and a small config file. Anything that can read a file can read the board. [Specification](https://shipbench.dev/docs/convention-spec).
- **ShipBench CLI.** Create, list, search, move, and check tasks from a terminal or a coding agent. [Reference](https://shipbench.dev/docs/cli-reference).
- **The local board.** `shipbench board` opens a Kanban board in the browser that updates when files change, and `shipbench board terminal` draws a read-only one in a terminal.
- **ShipBench Harbor.** An optional hosted client for shaping ideas before a repository exists and viewing public GitHub-backed boards read-only. Tasks never leave their repository. Harbor isn't deployed yet.

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

pnpm workspace monorepo, TypeScript strict, ESM only. No Turborepo; use `pnpm --filter` for targeted work.

```bash
pnpm install
pnpm --filter @shipbench/core build
pnpm typecheck
```

## Documentation

- [shipbench.dev/docs](https://shipbench.dev/docs): overview, quickstart, and reference.
- [Why ShipBench](https://shipbench.dev/docs/why/): why it exists.
- [docs/spec.md](docs/spec.md): the product spec.
- [docs/design-doctrine.md](docs/design-doctrine.md): the shared visual design doctrine.
- [AGENTS.md](AGENTS.md): architecture, conventions, and instructions for coding agents working in this repository.

This repository uses its own [`.shipbench/`](.shipbench/) directory as its live project board.
