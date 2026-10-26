# AGENTS.md — ShipBench

## Project overview

ShipBench is a Git-native project management system for solo developers. It is a file-based task management convention (`.shipbench/` directory) that lives inside any Git repo, plus the tools that read and write it: the core library, the CLI, and the Board UI. Tasks are Markdown files with YAML frontmatter. Fully self-contained — no account, no hosted service.

**This repository holds ShipBench and its site.** There is no hosted client; see the non-goals in [docs/spec.md](docs/spec.md#non-goals).

## Naming and branding

These rules cover every ShipBench surface: this repository, the site, and npm metadata. They're kept here, in public, so anyone writing copy or docs can find them.

**ShipBench is the system. The CLI and the board are ways of working with it.** Tasks live in repositories, and each tool reads and writes them there.

- The CLI's user-facing name is "ShipBench CLI," with the umbrella first.
- Packages stay under `@shipbench/*`. `@shipbench/core` and `@shipbench/board` publish from here, and the CLI's npm name is `shipbench`. Don't add unscoped sub-brand packages.

**Two fixed strings.** Use them as written. Don't swap them or invent variants.

- **Tagline: "Plans that ship with the work."** Use it where someone reads it as a statement: the hero, the footer, the social image, the top of a README. It stays domain-neutral because ShipBench is also used for writing and publishing, not only code.
- **Descriptor: "Git-native project management for solo developers."** Use it for search and categorization: `<title>`, the GitHub repository description, npm. Keep it in sentence case everywhere, `<title>` included, so it matches GitHub and npm.
- Don't put the two next to each other where they'd say the same thing twice.
- The tagline keeps its period wherever it reads as a sentence (the social image, alt text, a README) and drops it in label contexts such as badges and the footer. Both forms are the tagline.

**The meta description says why, not what.** The `<title>` next to it already says what ShipBench is, so `description`, and the `og:` and `twitter:` descriptions that reuse it, should give a reason to click. See `apps/site/src/config/site.ts`.

**Say only what the product does today.**

- Plans are per repository. Don't imply a view across projects unless a live client provides one.
- Nothing is recorded automatically. Task Updates and links between tasks exist because someone wrote them.
- Keeping a plan current is still the writer's job. Don't claim task files can't drift from the code.
- ShipBench works well with agents and works without them. It is a task management system that works well with AI, not an AI task management system, so agents shouldn't become the subject.
- There is no hosted ShipBench service. Don't describe one.

**Domain**: `shipbench.dev` is the official, owned domain. Anything ShipBench publishes lives under it, never on its own apex.

## Repository layout

```
shipbench/
├── packages/
│   ├── core/        # @shipbench/core — headless TypeScript library (parsing, validation, CRUD)
│   └── board/       # @shipbench/board — standalone React kanban board app
├── apps/
│   ├── cli/         # shipbench CLI — terminal tool using core + FS adapter
│   └── site/        # shipbench.dev — Astro marketing site + docs
├── docs/brand/      # The logo mark source + what derives from it
└── scripts/         # Repo-level tooling that spans apps (OG card generation)
```

pnpm workspace monorepo. No Turborepo — use `pnpm --filter` for targeted operations.

```bash
pnpm install                          # Install all dependencies
pnpm --filter @shipbench/core build   # Build core
pnpm --filter @shipbench/core dev     # Watch mode for core
pnpm --filter shipbench build         # Build CLI
pnpm typecheck                        # Typecheck everything, including tests/ and scripts/
pnpm generate:og                      # Rebuild the site's OpenGraph cards
```

The OG cards are generated from `scripts/og/` and committed; they are not part
of any build. See [docs/brand/README.md](docs/brand/README.md) before editing a
logo asset or social-image string.

`apps/site` carries a Playwright harness for the browser-only behaviour its
vitest suite structurally cannot reach — real Pagefind search, the native
`<dialog>` focus trap, first-paint theme correctness, and axe. It runs in CI,
path-filtered to changes that can actually affect the site. See
[apps/site/e2e/README.md](apps/site/e2e/README.md).

## Continuous integration

- **[.github/workflows/ci.yml](.github/workflows/ci.yml)** — every push to `main` and every pull request: install with `--frozen-lockfile`, typecheck, lint, test, build.
- **[.github/workflows/e2e.yml](.github/workflows/e2e.yml)** — the Playwright harness, filtered to `apps/site/**` and `pnpm-lock.yaml`. The site declares no `@shipbench/*` dependency, so a package change cannot alter its browser behaviour.
- **[.github/workflows/release.yml](.github/workflows/release.yml)** — changesets. Merging a changeset to `main` opens a version pull request; merging that publishes with npm provenance, authenticated by GitHub OIDC rather than a token. [docs/releasing.md](docs/releasing.md) is the operational reference; [.changeset/README.md](.changeset/README.md) covers when a change needs a changeset, how to write one, and why the three published packages are a fixed group.

## Architecture

### Dependency graph

```
core ← cli (core + FsAdapter, and board's standalone bundle at runtime)
core ← board (core types, plus the pure `@shipbench/core/layout`, `@shipbench/core/search`, and `@shipbench/core/flag` subpaths)
```

The core library is the foundation; the Board UI and CLI are consumers. `apps/site` depends on none of them — it is a standalone Astro site.

### Core library (`@shipbench/core`)

The core library is headless — no filesystem access, no UI, no network calls. All I/O goes through a `StorageAdapter` interface.

**Adapter pattern.** Core defines `StorageAdapter` (read/write/delete/list files, plus batch variants). One built-in implementation: `FsAdapter` for the local filesystem. The adapter surface is intentionally minimal so other hosts can supply their own.

**Config resolution.** Core maintains `DEFAULT_CONFIG` internally and deep-merges the user's `config.json` over it on read. Partial configs are fully supported — missing fields fall back to defaults. `shipbench init` scaffolds a complete config for discoverability, but users can delete blocks freely.

**Validation.** Strict on write: invalid statuses, priorities, or malformed fields are rejected. Graceful on read: tasks with unrecognized status values are returned with validation warnings, never dropped. Unknown frontmatter fields are preserved and passed through with a warning — core never strips data it doesn't own. A file whose frontmatter does not parse can't be a `Task`, so reads return it verbatim in `TaskReadResult.unreadable` instead of leaving it out, and single-task reads and writes throw `UnreadableTaskError`.

**Slug generation.** Core owns slugification (lowercase, hyphenated, no special characters) and collision handling (numeric suffixes: `my-task.md` → `my-task-2.md`). All consumers should create tasks through core to get consistent slugs.

**Timestamps.** Core auto-manages `created` (set once on creation, never modified) and `updated` (set on every mutation). Both ISO 8601.

Published to npm as `@shipbench/core`.

### Board UI (`@shipbench/board`)

Standalone React app that accepts a `BoardAPI` interface at initialization. The host environment (the CLI, or any other host) provides the data layer — the Board doesn't know or care where the data comes from.

The `BoardAPI` contract is defined in core's type exports. The Board imports types from core but never imports adapter implementations or business logic.

**The runtime exceptions: `@shipbench/core/layout`, `@shipbench/core/search`, and `@shipbench/core/flag`.**
Manual task ordering (`layoutAfterMove`, `layoutWithoutTask`,
`orderedTasksForColumn`) is shared contract, not business logic — the Board's
optimistic updates have to produce the same layout core writes, and keeping a
second copy in the Board is what let the two drift (see [docs/audits/board-move-algorithm-audit.md](docs/audits/board-move-algorithm-audit.md)).
`searchTasks` is shared for the same reason: a query has to mean the same thing
on the board as in `shipbench task search`. `taskFlag` is shared so a card, a
column count, and `task list --flagged` agree on which tasks are flagged. All
three modules are pure, do no I/O, and import only types.

Import them from their **subpaths**, never the barrel. `@shipbench/core` re-exports
`FsAdapter`, which imports `node:fs` — pulling the barrel into the Board breaks
the Vite browser build. Types are safe from either (`import type` is erased), but
any *value* the Board needs from core must live behind a pure subpath.

`onTasksChanged` is an optional callback on `BoardAPI` — enables live file-watching updates when the CLI hosts the board, degrades gracefully to polling when a host doesn't provide it.

`resolveRepoLink` follows the same optional shape: the Board resolves a Markdown link in a task body to a repo-root-relative path and asks the host where that points, so it never learns what GitHub or a filesystem is. A host with a web view of the repository can answer with a URL; the CLI omits the method and those links render as plain paths. See [docs/board/design.md](docs/board/design.md#markdown-links).

Published to npm for convenience, not for public use: the CLI needs the standalone bundle at runtime, and an out-of-repository host needs the compiled library resolvable. External consumption is not a supported use case — the version stays `0.x` and breaking changes ship unremarked.

Full design intent (stack, state model, sync model, layouts, build plan) lives in [docs/board/design.md](docs/board/design.md). Read that before editing the Board package.

### CLI (`shipbench`)

Uses `@shipbench/core` with `FsAdapter` rooted at `process.cwd()`. Commands: `init`, `task create`, `task comment`, `task get`, `task flag` / `task unflag`, `task move`, `task list`, `task search`, `task graph`, `task archive` / `task unarchive`, `task delete`, and `board`. The `board` command starts a local server hosting the Board UI with file watching for live updates.

### Dogfooding ShipBench in this repo

This repo uses its own `.shipbench/` directory as the live project board. The board contract — task selection, file rules, the review gate, archiving, worktree conventions — lives in [.shipbench/AGENTS.md](.shipbench/AGENTS.md). Read it before any board operation and follow it exactly as a normal project's agents would. The one rule worth repeating here: move finished work to `review`, never to `done`.

Two things are repo-specific because this repo is also where the `shipbench` CLI is built:

- **Use the local built CLI from the repo root.** Wherever `.shipbench/AGENTS.md` says `shipbench ...`, run `node apps/cli/dist/index.js ...` instead:

  ```powershell
  node apps/cli/dist/index.js task list --available --json
  node apps/cli/dist/index.js task get <slug>
  node apps/cli/dist/index.js task move <slug> --to=in-progress
  ```

- **Avoid `pnpm --filter shipbench exec shipbench ...`** for dogfood task operations. Both the workspace root and `apps/cli` are named `shipbench`, so that command can run in multiple package contexts and fail from `apps/cli`, where no `.shipbench/config.json` exists.

**Expect board changes you didn't make.** This board is live while you work. The owner moves tasks in the Board UI, other agents claim and finish tasks, and your own `task move` rewrites `layout.json`. So `git status` will often show task files and `layout.json` that changed while you were working, including other tasks' files.

- **Look before you act.** Diff an unexpected change to see what it is (a status move, a new Update, a reordered column), so you know it isn't yours.
- **Never undo it.** Don't `git checkout`, `git restore`, `git stash`, or re-edit a file to put it back the way it was. A change you didn't make is someone else's work, and reverting it quietly loses a decision the owner or another agent made.
- **Leave it out of your work.** Stage only the files your task changed. `layout.json` is the exception when your own `task move` touched it; stage it with your task file. If it also holds someone else's change, such as a new task's entry, leave it unstaged and say so, because staging it would commit half of their change.
- **Report it.** When you hand back your work, name the files that changed outside your work and say you left them alone.

The same applies to any other file that changed without you: check it, leave it as it is, and mention it. If you changed a file by accident (a formatter run over a whole directory, say), say so and let the owner decide whether to discard it.

`.shipbench/AGENTS.md` is deliberately kept close to what `shipbench init` scaffolds, customized only where this board's contract differs (backlog column, review gate, worktree rules). If work in this repo seems to require deviating from it, that is a signal — either the rule is build-specific and belongs in this file, or the shipped convention is missing something. Say so instead of silently deviating.

## The `.shipbench/` convention

```
.shipbench/
├── config.json          # Board configuration (columns, priorities, schema)
├── layout.json          # Machine-managed manual task ordering
├── README.md            # Human-readable board docs
├── AGENTS.md            # Machine-readable agent instructions
└── tasks/
    ├── setup-auth.md    # Slug-based filenames
    ├── build-api.md
    └── archive/         # Archived tasks — do not read unless asked
```

### config.json

```json
{
  "version": 1,
  "columns": [
    { "id": "todo", "label": "To Do" },
    { "id": "in-progress", "label": "In Progress" },
    { "id": "done", "label": "Done" }
  ],
  "done_column": "done",
  "done_display": { "max": 20 },
  "priority": {
    "values": ["low", "medium", "high"],
    "default": "medium"
  },
  "schema": {
    "custom_fields": {}
  }
}
```

- `columns[].id` values are the valid `status` values for task frontmatter. The `label` is what the Board UI displays.
- `done_column` references exactly one column ID as the completion state.
- `done_display.max` caps how many done tasks the board renders by default (most-recently-updated first). `0` or negative disables the cap. Search bypasses the cap. Omit the field to fall back to a default of 20. The done column also ignores manual `layout` order and time-sorts by `updated` desc.
- Deep-merged with `DEFAULT_CONFIG` at read time. Any field can be omitted.

### layout.json

`layout.json` contains the per-column `BoardLayout` record used for manual task ordering. It is machine-managed by core; agents should not hand-edit it. Reads prefer `layout.json`, fall back to the legacy `config.layout` field, then `{}`. A missing or gitignored file is valid, but fresh clones then use deterministic fallback ordering. The first layout write migrates legacy config by creating `layout.json` and removing only the old `layout` key.

### Task file format

```markdown
---
title: Setup GitHub OAuth
status: todo
priority: medium
assignee:
tags: [auth, backend]
created: 2026-06-16T10:00:00Z
updated: 2026-06-16T10:00:00Z
---

Freeform Markdown body.
```

| Field      | Required | Notes                                                                                                       |
| ---------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| title      | Yes      | Display name                                                                                                |
| status     | Yes      | Must match a `columns[].id` in config                                                                       |
| priority   | No       | Must match a `priority.values` entry                                                                        |
| assignee   | No       | Freeform string label (e.g. `claude`, `human`). Informational only — no built-in claiming/locking behavior. |
| tags       | No       | Array of freeform strings                                                                                   |
| depends_on | No       | Slugs that must finish first. Data only — never gates writes or moves columns.                              |
| flag       | No       | A one-line reason, or `true`. Asks for attention in any column. Informational only — never cleared for you. |
| created    | Yes      | Auto-managed by core. Do not modify.                                                                        |
| updated    | Yes      | Auto-managed by core. Do not modify.                                                                        |

`depends_on` is strict on write (unknown slug, self-reference, and direct two-hop cycles are rejected) and graceful on read (a dangling slug becomes a validation warning; the task still loads). Agents selecting work should prefer tasks whose every `depends_on` entry sits in the `done` column or resolves to `tasks/archive/` (archived dependencies count as satisfied), and treat prose `## Depends on` sections as commentary.

`flag` is generic on purpose: what it means (blocked, needs a decision, needs review) is each project's call. It is strict on write (a blank or multi-line reason, or any value other than a string or `true`, is rejected) and graceful on read (any other value reads as unflagged, with a warning). Nothing sets or clears it as a side effect; `task flag` / `task unflag` and the Board's detail view do it on purpose.

Tasks with invalid statuses on read are surfaced with warnings. The Board UI renders them in an "Uncategorized" column. They are never hidden or dropped.

A task file whose frontmatter does not parse is not dropped either. Reads return it in `unreadable`, the Board shows it as a read-only card in an "Unreadable" column, and `task list` / `task search` print it beside the tasks. It stays that way until someone fixes the file.

### Task archiving

Any task can be archived: the file moves byte-identical to `tasks/archive/<slug>.md` (frontmatter and timestamps untouched), invisible to board reads and search, restorable with `task unarchive`. Slugs are never reused across live + archive. Archive listings sort by `updated` desc — deliberately no `archived_at` field; Git records filing time.

## Code conventions

- TypeScript, strict mode, ESM only (`"type": "module"` in all packages).
- `tsup` for building core and CLI. Vite for board.
- `gray-matter` for frontmatter parsing.
- Workspace dependencies use the `"workspace:*"` protocol.
- Comments explain code, not copy. The reasoning behind a piece of public copy or a design choice goes in the task record, not in a comment next to it.

## Architectural boundaries

These are deliberate design decisions, not oversights:

- **Tasks live in repos, not databases.** Every tool reads and writes tasks where they live, in the repository's files. Nothing keeps its own task storage. This is the core architectural invariant.
- **The Board is adapter-driven.** It accepts a `BoardAPI` and renders. It does not make assumptions about where data comes from or how it's persisted.
- **Agents are supported through convention, not infrastructure.** The `.shipbench/` directory, `AGENTS.md`, and CLI commands are designed to be agent-friendly by default. There is no agent orchestration layer, no task claiming system, no agent-specific workflow logic. Platform-specific agent tooling (Claude Code skills, Cursor rules, etc.) lives in this repository as reference files users can copy — it is not bundled into projects.
- **Solo developer scope.** The end user is an individual developer — no collaboration, no sharing, no permissions model.
- **No hosted service.** ShipBench runs locally against the repository. There is no account, server, or hosted client.

## Reference

[docs/spec.md](docs/spec.md) contains the product spec — the convention, core, Board, and CLI in design detail, plus the non-goals this project has settled.

[docs/design-doctrine.md](docs/design-doctrine.md) is the ShipBench-wide visual design doctrine — tokens, typography, geometry, iconography, and component primitives. The Board and the site both implement it; any design-related task treats it as ground truth.
