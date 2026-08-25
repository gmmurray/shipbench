# AGENTS.md — ShipBench

## Project overview

ShipBench is a Git-native project management system for solo developers. It has two decoupled products:

1. **The Project System** — A file-based task management convention (`.shipbench/` directory) that lives inside any Git repo. Tasks are Markdown files with YAML frontmatter. Fully self-contained — works without Harbor or any external service.
2. **Harbor** — A standalone web app for managing project ideas and viewing task boards across multiple repos via the GitHub API. Built for solo developers: each account is one developer's own workbench. "Solo dev" is the target end user (any solo developer, not just this project's author), not a statement that Harbor is single-user.

## Naming and branding

**ShipBench is the system. Harbor (and the CLI) are clients for it.** Tasks live in repos; Harbor is one surface for managing them, the CLI is another. This relationship is load-bearing — keep it visible everywhere:

- **Umbrella name everywhere**: ShipBench. Never refer to the whole project as "Harbor."
- **User-facing product names**: "ShipBench CLI" and "ShipBench Harbor" (proper-noun Harbor). The umbrella always comes first.
- **In Harbor's own copy**: lead with "Harbor" in headers, but anywhere it explains itself, mention ShipBench (e.g. "Sign in to Harbor to manage your ShipBench projects"). Harbor's brand should never swallow the convention's identity.
- **Package names** stay scoped to `@shipbench/*`: `@shipbench/core`, `@shipbench/board`, `@shipbench/harbor`. The CLI's npm name is `shipbench` (it's the namesake binary). Don't introduce unscoped sub-brand packages.
- **Inside the codebase**, lowercase `harbor` is fine as a working name (directory, package suffix, slug). Reserve the proper noun "Harbor" for user-facing surfaces.

**Tagline vs. descriptor**: two canonical strings with different jobs. Don't swap them and don't invent variants.

- **Tagline — "Plans that ship with the work."** Carries the reason. Use it where a human reads it as a statement: the site footer, the hero, the social image, the top of a README. Deliberately domain-neutral — ShipBench is used for writing and posts as well as code (see [docs/why.md](docs/why.md)), so the tagline must never narrow to code.
- **Descriptor — "Git-native project management for solo developers."** Says what shelf the project is on and carries no reason. Use it where the job is search and categorization: `<title>`, meta description, the GitHub repository description, npm.

The two must not appear as each other's neighbors restating one claim twice. `docs/why.md` is the full argument both compress.

**Domain**: `shipbench.dev` is the official, owned domain. Harbor lives under it (`harbor.shipbench.dev`), never on its own apex. No Harbor-first domain.

## Monorepo layout

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
pnpm generate:og                      # Rebuild the OpenGraph cards for site + Harbor
```

The OG cards are generated from `scripts/og/` and committed; they are not part
of any build. See [docs/brand/README.md](docs/brand/README.md) before editing a
logo asset or social-image string.

`apps/site` carries a Playwright harness for the browser-only behaviour its
vitest suite structurally cannot reach — real Pagefind search, the native
`<dialog>` focus trap, first-paint theme correctness, and axe. It is opt-in and
never runs automatically. See [apps/site/e2e/README.md](apps/site/e2e/README.md).

## Architecture

### Dependency graph

```
core ← cli (core + FsAdapter)
core ← board (core types, plus the pure `@shipbench/core/layout` subpath)
core + board ← harbor (hosts board, provides adapters)
```

The core library is the foundation. The Board UI and CLI are consumers. Harbor composes both.

### Core library (`@shipbench/core`)

The core library is headless — no filesystem access, no UI, no network calls. All I/O goes through a `StorageAdapter` interface.

**Adapter pattern.** Core defines `StorageAdapter` (read/write/delete/list files, plus batch variants). Two built-in implementations: `FsAdapter` for local filesystem, `GitHubAdapter` for the GitHub Contents API. The adapter surface is intentionally minimal to make future adapters (GitLab, Bitbucket) trivial.

**Config resolution.** Core maintains `DEFAULT_CONFIG` internally and deep-merges the user's `config.json` over it on read. Partial configs are fully supported — missing fields fall back to defaults. `shipbench init` scaffolds a complete config for discoverability, but users can delete blocks freely.

**Validation.** Strict on write: invalid statuses, priorities, or malformed fields are rejected. Graceful on read: tasks with unrecognized status values are returned with validation warnings, never dropped. Unknown frontmatter fields are preserved and passed through with a warning — core never strips data it doesn't own.

**Slug generation.** Core owns slugification (lowercase, hyphenated, no special characters) and collision handling (numeric suffixes: `my-task.md` → `my-task-2.md`). All consumers should create tasks through core to get consistent slugs.

**Timestamps.** Core auto-manages `created` (set once on creation, never modified) and `updated` (set on every mutation). Both ISO 8601.

Published to npm as `@shipbench/core`.

### Board UI (`@shipbench/board`)

Standalone React app that accepts a `BoardAPI` interface at initialization. The host environment (CLI or Harbor) provides the data layer — the Board doesn't know or care whether it's talking to a local server or the GitHub API.

The `BoardAPI` contract is defined in core's type exports. The Board imports types from core but never imports adapter implementations or business logic.

**The one runtime exception: `@shipbench/core/layout`.** Manual task ordering
(`layoutAfterMove`, `layoutWithoutTask`, `orderedTasksForColumn`) is shared
contract, not business logic — the Board's optimistic updates have to produce the
same layout core writes, and keeping a second copy in the Board is what let the
two drift (see [docs/audits/board-move-algorithm-audit.md](docs/audits/board-move-algorithm-audit.md)).
That module is pure, does no I/O, and imports only types.

Import it from the **subpath**, never the barrel. `@shipbench/core` re-exports
`FsAdapter`, which imports `node:fs` — pulling the barrel into the Board breaks
the Vite browser build. Types are safe from either (`import type` is erased), but
any *value* the Board needs from core must live behind a pure subpath.

`onTasksChanged` is an optional callback on `BoardAPI` — enables live file-watching updates when the CLI hosts the board, degrades gracefully when Harbor hosts it in remote mode.

`resolveRepoLink` follows the same optional shape: the Board resolves a Markdown link in a task body to a repo-root-relative path and asks the host where that points, so it never learns what GitHub or a filesystem is. Harbor answers with a `blob/HEAD` URL; the CLI omits the method and those links render as plain paths. See [docs/board/design.md](docs/board/design.md#markdown-links).

Internal monorepo package. Not published to npm — only consumed by the CLI and Harbor.

Full design intent (stack, state model, sync model, layouts, build plan) lives in [docs/board/design.md](docs/board/design.md). Read that before editing the Board package.

### CLI (`shipbench`)

Uses `@shipbench/core` with `FsAdapter` rooted at `process.cwd()`. Commands: `init`, `connect`, `task create`, `task comment`, `task get`, `task move`, `task list`, `task search`, `task graph`, `task archive` / `task unarchive`, `task delete`, and `board`. The `board` command starts a local server hosting the Board UI with file watching for live updates.

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

`.shipbench/AGENTS.md` is deliberately kept close to what `shipbench init` scaffolds, customized only where this board's contract differs (backlog column, review gate, worktree rules). If work in this repo seems to require deviating from it, that is a signal — either the rule is build-specific and belongs in this file, or the shipped convention is missing something. Say so instead of silently deviating.

### Harbor (`@shipbench/harbor`)

**Stack:** Cloudflare ecosystem (Workers, D1, Clerk for auth).

**Two concerns, cleanly separated:**

- Idea management — Harbor's own data in D1. Ideas have user-configurable status folders, tags, descriptions, tech stack notes, and optional links to related ideas.
- Project boards — Harbor hosts the Board UI and provides the adapter. Remote mode only: read-only via the GitHub API adapter. Boards are not editable through Harbor; edits happen where the code lives.

**Harbor never stores tasks.** Tasks always live in a repo's `.shipbench/` directory. Every project in Harbor has a backing Git repo.

**Auth stays low-privilege:** GitHub OAuth via Clerk for login; board reads use the user's OAuth token (public repos only). Harbor makes no writes to GitHub and never asks for repository write access.

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

`layout.json` contains the per-column `BoardLayout` record used for manual task ordering. It is machine-managed by core; agents should not hand-edit it. Reads prefer `layout.json`, fall back to the legacy `config.layout` field, then `{}`. A missing or gitignored file is valid, but Harbor and fresh clones then use deterministic fallback ordering. The first layout write migrates legacy config by creating `layout.json` and removing only the old `layout` key.

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
| created    | Yes      | Auto-managed by core. Do not modify.                                                                        |
| updated    | Yes      | Auto-managed by core. Do not modify.                                                                        |

`depends_on` is strict on write (unknown slug, self-reference, and direct two-hop cycles are rejected) and graceful on read (a dangling slug becomes a validation warning; the task still loads). Agents selecting work should prefer tasks whose every `depends_on` entry sits in the `done` column or resolves to `tasks/archive/` (archived dependencies count as satisfied), and treat prose `## Depends on` sections as commentary.

Tasks with invalid statuses on read are surfaced with warnings. The Board UI renders them in an "Uncategorized" column. They are never hidden or dropped.

### Task archiving

Any task can be archived: the file moves byte-identical to `tasks/archive/<slug>.md` (frontmatter and timestamps untouched), invisible to board reads and search, restorable with `task unarchive`. Slugs are never reused across live + archive. Archive listings sort by `updated` desc — deliberately no `archived_at` field; Git records filing time.

## Code conventions

- TypeScript, strict mode, ESM only (`"type": "module"` in all packages).
- `tsup` for building core and CLI. Vite for board.
- `gray-matter` for frontmatter parsing.
- Workspace dependencies use the `"workspace:*"` protocol.

## Architectural boundaries

These are deliberate design decisions, not oversights:

- **Tasks live in repos, not databases.** Harbor reads and writes tasks through the GitHub API or local filesystem. It does not have its own task storage. This is the core architectural invariant.
- **The Board is adapter-driven.** It accepts a `BoardAPI` and renders. It does not make assumptions about where data comes from or how it's persisted.
- **Agents are supported through convention, not infrastructure.** The `.shipbench/` directory, `AGENTS.md`, and CLI commands are designed to be agent-friendly by default. There is no agent orchestration layer, no task claiming system, no agent-specific workflow logic. Platform-specific agent tooling (Claude Code skills, Cursor rules, etc.) lives in the ShipBench repo as reference files users can copy — it is not bundled into projects.
- **Solo developer scope.** The end user is an individual developer. Harbor is multi-account (Clerk, `user_id` scoping everywhere), but each account is an isolated single-developer workspace — no collaboration, no sharing, no permissions model.
- **Cloudflare-native for Harbor.** Workers, D1, Pages. Auth through Clerk.

## Reference

[docs/spec.md](docs/spec.md) contains the product spec — the convention, core, Board, and CLI in design detail, plus a product-level description of Harbor and the non-goals this project has settled. Harbor's implementation lives in a separate private repository and is not specified here.

[docs/design-doctrine.md](docs/design-doctrine.md) is the ShipBench-wide visual design doctrine — tokens, typography, geometry, iconography, and component primitives. Harbor and the Board both implement it; any design-related task treats it as ground truth.
