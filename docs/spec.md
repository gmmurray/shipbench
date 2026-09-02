# ShipBench — Product Spec

## Motivation

Solo developers working with AI now ship at the scale of a small team — several workstreams in flight, often across several repositories — while the tools for managing that work still assume either one person with a checklist or an organization with a process. Hosted trackers charge a per-project setup cost that made sense when a team used one workspace for a year and does not when one person starts a project a month. Todo lists sit in the right place and hold no state. ShipBench's premise is that the repository already contains the code, the documentation, and the architecture decisions, so the plan belongs there too.

Everything below follows from that premise: tasks are files, Git carries the history, and every client is optional. The full argument — including what ShipBench deliberately declines to decide — is in [why.md](why.md).

## Overview

ShipBench is a Git-native project management system for solo developers. It consists of two decoupled products:

1. **The Project System** — A file-based task management convention that lives inside any Git repo. Tasks are Markdown files in a `.shipbench/tasks/` directory, governed by a local config. Any tool that can read and write files — a CLI, a web UI, or an autonomous agent — can interact with the board. The project system is fully self-contained; it does not require Harbor or any external service.

2. **ShipBench Harbor** — A standalone web application whose primary surface is idea management, with read-only visibility into project task boards across multiple repos via the GitHub API. Built for solo developers — each account is one developer's own workbench. Think "my workbench," not "Linear for one." (Solo-dev describes the target end user — any solo developer, the author included — not a single-user deployment.)

The two products share a common core library (`@shipbench/core`) for task file manipulation, ensuring format consistency regardless of where edits originate.

User-facing surfaces are always prefixed with the umbrella name: **ShipBench CLI** and **ShipBench Harbor**. The package namespace `@shipbench/*` mirrors this. Full naming and branding doctrine lives in [CLAUDE.md](../CLAUDE.md) under "Naming and branding."

**Domain:** `shipbench.dev` is the official, owned domain. Harbor lives under it (e.g. `harbor.shipbench.dev` — exact subdomain TBD), never on its own apex.

---

## Architecture & Stack

ShipBench is a TypeScript monorepo managed with pnpm workspaces.

```
shipbench/
├── packages/
│   ├── core/                 # @shipbench/core — headless library + adapters
│   └── board/                # @shipbench/board — React kanban board app
├── apps/
│   ├── cli/                  # shipbench CLI — terminal tool (bundled via tsup)
│   └── site/                 # shipbench.dev — Astro marketing site + docs
└── docs/
    ├── spec.md               # This document
    └── board/design.md       # Board UI design intent (stack, state, layouts)
```

Conventions:

- **TypeScript strict, ESM only.**
- **Tooling**: Biome (format + lint), Vitest (test), tsup (build for core + CLI), Vite (build + dev for Board).
- **Source-pointing exports**: `@shipbench/core`'s `exports` map points at `src/` during dev so consumers can import core without a build step. `publishConfig` swaps to `dist/` paths on publish.
- **No Turborepo.** Use `pnpm --filter` for targeted operations.

---

## Distribution

The end-state shape once shipped:

- **`@shipbench/core`, `shipbench` (CLI), and `@shipbench/board`** live in a **public** repository and publish to npm. Core and the CLI are the primary public interfaces; the CLI's binary is unscoped by convention (matches `astro`, `vite`, `next`, `wrangler`, etc.). Sub-packages are scoped `@shipbench/*`.
- **`@shipbench/board` publishes for convenience, not for public use.** The CLI depends on it at runtime for the standalone bundle, and any out-of-repository consumer (Harbor being the obvious one) needs it available on the registry. External consumption is not a supported use case — the version stays 0.x and breaking changes go unremarked.
- **Harbor is a deployed application, not a library.** It lives in a separate **private** repository and consumes `@shipbench/board` + `@shipbench/core` from npm. (Private code, but a multi-account hosted service — any solo dev can sign in.)
- **Synchronized versioning** across the three published packages (Angular/Astro/Next model): all three release at the same version. `workspace:*` refs are rewritten to the current version at publish time. Simpler than a compatibility matrix; downstream consumers don't reason about which core version pairs with which CLI.
- Publishing prep — `files` fields, LICENSE, READMEs, scoped package access, and repository metadata — is tracked on this repository's own board under `.shipbench/`.

---

## Components

### 1. Project Convention

The spec for what lives inside a repo. This is the contract that all other components build against.

**Directory structure:**

```
.shipbench/
  config.json        # Human-owned project configuration (board, name)
  layout.json        # Machine-managed manual task ordering
  README.md          # Human-readable project board docs
  AGENTS.md          # Machine-readable agent instructions (templated on init)
  tasks/
    setup-auth.md    # Slug-based task filenames
    build-api.md
    design-landing.md
    archive/         # Archived task files (see "Task archiving")
```

#### config.json

Defines the project board structure. ShipBench provides sensible defaults — the config only needs to declare overrides and additions.

```json
{
  "version": 1,
  "name": "my-project",
  "columns": [
    { "id": "todo", "label": "To Do" },
    { "id": "in-progress", "label": "In Progress" },
    { "id": "done", "label": "Done" }
  ],
  "default_column": "todo",
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

**`name` (required).** The project's display name. Every consumer (CLI, Board, Harbor) reads this field for the breadcrumb root. `shipbench init` defaults it to the basename of the current working directory; `--name "Some Name"` overrides. `name` lives in the project's own metadata for the same reason `package.json#name`, `Cargo.toml#package.name`, etc. do — the project owns its identity, hosts read it.

**`columns`.** The source of truth for valid `status` values. The `id` is used in task frontmatter; the `label` is what the Board UI displays. Adding a new column (e.g., `review`) means appending to `columns` — the core library validates status values against this list.

**`default_column`.** References the column ID used when creating a task without an explicit `status` (for example, `shipbench task create "Task title"` or the Board's new-task dialog). Validated to reference an existing column ID. If omitted from an older partial config, core falls back to the first configured column.

**`done_column`.** References a single column ID representing task completion. Governs done-column rendering (time-sort + display cap), identifies bulk-archiving candidates (`task archive --done`), and gates the archive dependents guard (see "Task archiving"). Validated to reference an existing column ID.

**`done_display`.** Controls how the done column is rendered on the board. `max` is the count cap on the default view — the N most-recently-updated done tasks show, the rest live behind a "Show more" toggle. `max: 0` (or negative) disables the cap entirely. Omitting `done_display` falls back to the default cap of 20. The cap is bypassed when a search query is active so hidden matches remain findable. `max` must be an integer.

**`priority`.** Available priority values and the default. Custom fields in `schema.custom_fields` allow projects to extend frontmatter without modifying the core schema (shape TBD as needs emerge).

#### layout.json

Machine-managed per-column task order, containing exactly a `BoardLayout` record with no version wrapper:

```json
{
  "todo": ["setup-auth", "build-landing"],
  "in-progress": ["design-board"]
}
```

Reads prefer `layout.json`, fall back to the legacy `config.layout` field, then `{}`. A missing file is a valid first-class state; the board uses deterministic fallback ordering. The first layout write in a legacy repo creates `layout.json` and removes only `layout` from `config.json`. Users may gitignore `layout.json` for machine-local order, with the tradeoff that Harbor and fresh clones render fallback order. Render rules and stale-slug behavior are documented in [docs/board/design.md](board/design.md#task-ordering). Summary:

- Tasks whose slug appears in `layout[columnId]` render in that order.
- Tasks whose status matches a column but whose slug isn't in `layout[columnId]` render below, sub-sorted by `created` desc.
- Slugs in `layout` that don't correspond to any task on disk are ignored at render time, and pruned eagerly on writes that touch that column.
- The Uncategorized column (see below) ignores `layout` entirely and renders by `created` desc.
- The done column (identified by `done_column`) likewise ignores `layout` and renders by `updated` desc (most-recently-touched first). Manual within-column reorder is disabled for done tasks. Cross-column drops into done still work, but no done-column order is recorded; any existing `layout[done_column]` entry is pruned on the next layout write.

**Config resolution.** The core library maintains an internal `DEFAULT_CONFIG` and deep-merges the user's `config.json` over the top of it on read. Partial configs are fully supported — developers can delete any block they don't care about and the system falls back to default behavior. `shipbench init` (and Harbor's seed commit) scaffolds a fully populated config to keep options discoverable.

#### Status conflict handling

**On write: strict.** The core library rejects any task creation or status change that references a column ID not present in `config.columns`, an invalid priority, an empty title, or an empty/whitespace-only `name`.

**On read: graceful.** Tasks with unrecognized statuses (e.g., a column was removed from config, a Git merge introduced tasks from a branch with different columns, or a manual edit has a typo) are not hidden or discarded. The Board UI surfaces them in a catch-all "Uncategorized" column at the trailing edge of the board, making them visible and draggable to a valid column. The core library flags these tasks with a validation warning but still returns them. Never silently lose tasks.

A file with syntactically malformed YAML cannot form a valid `Task`. Core skips only that file, returns every other readable task, and adds a `frontmatter` warning naming the malformed file. The same rule applies to live and archived task listings. Mutations remain strict: attempting to update a malformed task file fails until its frontmatter is repaired.

#### Task file format

Task filenames are slugified from the title on creation. Slug generation is centralized in core and handles Unicode normalization (NFD strip-diacritics) plus numeric-suffix collision handling (`setup-auth.md` → `setup-auth-2.md`).

**Default frontmatter schema:**

```markdown
---
title: Setup GitHub OAuth
status: todo
priority: medium
assignee:
tags: [auth, backend]
created: 2026-06-16T10:00:00.000Z
updated: 2026-06-16T10:00:00.000Z
---

Freeform Markdown body. Description, acceptance criteria, notes, links, whatever.

## Task Updates

### 2026-07-24T20:00:00.000Z
Raised priority after the customer escalation.
```

| Field      | Required | Managed by                                           | Notes                                                                                                            |
| ---------- | -------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `title`    | Yes      | User/agent                                           | Display name of the task. Must contain at least one slug-able character.                                         |
| `status`   | Yes      | Core library validates against `config.columns[].id` | Determines board column.                                                                                         |
| `priority` | No       | User/agent                                           | Validated against `config.priority.values`. Defaults to `config.priority.default`.                               |
| `assignee` | No       | User/agent                                           | Freeform string. No built-in behavior — just a filterable label. Useful for distinguishing human vs. agent work. |
| `tags`     | No       | User/agent                                           | Array of freeform strings. Filterable. No validation — tags are open-ended by design.                            |
| `created`  | Yes      | Core library (auto-set on creation, immutable)       | ISO 8601 timestamp.                                                                                              |
| `updated`  | Yes      | Core library (auto-set on mutation)                  | ISO 8601 timestamp.                                                                                              |

The description above `## Task Updates` is freeform Markdown. `createTask` takes it as an optional body, `updateTask` replaces it, and both refuse a body carrying an unfenced `## Task Updates` heading — serialization writes the body verbatim, so such a heading would silently file part of the description as comments on the next read. Core parses the reserved trailing section into `Task.comments: { timestamp, text }[]`; the Board renders it separately from the editable description. `addComment` and `shipbench task comment` append entries with the current ISO 8601 timestamp. `editComment` changes an entry's text by zero-based index without changing its timestamp; `deleteComment` removes an entry by index. Both mutations update the task's `updated` timestamp. Git preserves the earlier text or deleted entry as the audit and recovery trail.

A malformed Updates section never drops the task or throws during reads: core leaves its raw Markdown in `Task.body`, returns no parsed entries, and adds an `updates` validation warning. Comment mutations reject malformed sections until the user repairs the Markdown. Unknown frontmatter fields are likewise preserved with a warning (so typos like `proirity` surface to the UI without losing data).

Updates are a curated record of facts whose meaning depends on when they happened: decisions, pivots, scope changes, and external events. Ask whether a fact would remain true or relevant regardless of when it happened. If yes, edit the description in place; if the moment matters, append an Update. This is guidance, not a schema rule. Core stores `{ timestamp, text }` and never judges entry prose, so developers may use the section as a general comments log.

#### Task archiving

Any task can be archived — done tasks are just the bulk case. Archiving moves the file byte-identical to `.shipbench/tasks/archive/<slug>.md`: frontmatter (including `status`) and timestamps are untouched, so unarchiving restores the task exactly as it was.

- **Invisible to the hot path.** Normal reads never see the archive — both adapters' directory listings exclude subfolders, so `listTasks`, board loads, and search cost nothing extra. The archive is read only on explicit request: `listArchivedTasks`, `task list --archived`, or the Board's archive view (which fetches lazily on first open).
- **Search never reaches the archive.** Board search scans loaded live tasks; the zero-results state says so and links to the archive view. Retrieval paths are the archive view and `task list --archived`.
- **Sort order.** Archive listings sort by `updated` desc — the same key as the done column, so the capped done column and the archive read as one continuous timeline. There is deliberately no `archived_at` field: it would break the byte-identical round-trip, and Git already records filing time (`git log --diff-filter=A -- .shipbench/tasks/archive/`).
- **Slug namespace is unique across live + archive.** New tasks cannot reuse an archived slug (collision handling appends numeric suffixes as usual), so unarchive can never collide and `depends_on` references stay unambiguous forever.
- **Dependents guard.** Archiving a task in `done_column` — or one no live task depends on — is silent. Archiving a non-done task with live dependents throws `ArchiveBlockedError` (listing the dependents) unless forced: `--force` in the CLI, a confirm dialog listing dependents in the Board. Consequently an archived `depends_on` entry counts as satisfied — it is either genuinely done or was force-archived deliberately.
- **Ownership.** Archiving happens through the CLI and the Board's writable modes (detail-view action with undo toast; archive view for browse/restore). Harbor's read-only remote mode never archives — by construction, since it never writes. Nothing archives automatically; bulk archiving is always an explicit command.

#### README.md & AGENTS.md

Both are templated from the project's `name` and `config.json` during `shipbench init`. `README.md` is human-facing; `AGENTS.md` is machine-facing and structured for agent comprehension (directory structure, task format, valid statuses/priorities, slug rules, operations). Both can be edited freely after generation.

#### Agent workflow expectations

ShipBench is intentionally useful to agents without requiring an agent runtime. The expected loop is simple: read the repo's normal project guidance, read `.shipbench/AGENTS.md`, inspect the relevant task file, make the code or doc change, verify it, then move the task by updating `status` and `updated`. When the CLI is available, agents should prefer `shipbench task create`, `shipbench task edit`, `shipbench task move`, and `shipbench task comment` over hand-editing managed structures so slug generation, validation, timestamps, Updates parsing, and layout updates stay centralized in core. Direct file edits remain valid for interoperability and for environments where the CLI is not installed.

Task bodies should stay freeform, but agent-authored tasks benefit from a predictable shape: context, where to look, acceptance criteria, and verification notes. ShipBench does not enforce that structure; it is a writing convention that makes the file format more useful to humans and agents alike.

#### Platform-specific agent tooling

Claude Code skills, Cursor rules, Windsurf rules, etc. are maintained in the ShipBench repo as reference files. Users copy what they need into their own projects. Not shipped by default — the agent tooling landscape moves too fast to bundle opinions about specific platforms.

_Open questions:_

- Should the `version` field in config gate behavior in the core library, or is it just informational for now?
- Do tags need any config-level definition (e.g., suggested tags list), or are they purely freeform?

---

### 2. Core Library (`@shipbench/core`)

A headless TypeScript library for reading, creating, updating, moving, reordering, and deleting task files according to the project convention. Published to npm. No filesystem access, no UI, no network calls — all I/O goes through a `StorageAdapter` interface.

**Adapter pattern.** Core defines a two-tier adapter surface and ships two built-in implementations:

- **`FsAdapter`** — Full read/write/delete on the local filesystem. Implements the full `StorageAdapter` interface. Used directly by the CLI.
- **`GitHubAdapter`** — Reads `.shipbench/` via the GitHub Contents API. Implements the read-only `ReadableStorageAdapter` interface; `writeFile` / `writeFiles` exist as concrete class methods but currently have no consumer — they were built for Harbor's onboarding write flows, which are deferred (Harbor makes no GitHub writes for now). Delete is intentionally unimplemented — nothing in the current or planned architecture deletes via GitHub. Cross-runtime base64 (works in Node, Cloudflare Workers, and browsers).

Both adapters are exported directly from `@shipbench/core`. The surface is intentionally minimal to keep future adapters (GitLab, Bitbucket) trivial.

**Adapter interfaces:**

```typescript
// Read-only surface — the type held by consumers that only display data
// (e.g. Harbor's remote board mode). Statically prevents write attempts.
interface ReadableStorageAdapter {
  readFile(path: string): Promise<string>;
  readFileIfExists(path: string): Promise<string | null>;
  listFiles(directory: string): Promise<string[]>;
  readFiles(paths: string[]): Promise<Map<string, string>>;
}

// Full read/write surface. Used by anything that mutates `.shipbench/` —
// the CLI and in-repo agents.
interface StorageAdapter extends ReadableStorageAdapter {
  writeFile(path: string, content: string): Promise<void>;
  writeFiles(files: Map<string, string>): Promise<void>;
  deleteFile(path: string): Promise<void>;
}
```

Batch methods are required on all adapters; their implementation can be trivial (sequential calls) when latency isn't a concern.

**Core responsibilities:**

- Parse and validate `config.json` (deep-merge with `DEFAULT_CONFIG`, validate `name`, columns, `default_column`, `done_column`, `done_display.max` integer, priority) and load/validate layout keys from `layout.json` with legacy fallback.
- Read/write task Markdown files with frontmatter via `gray-matter`.
- Enforce schema constraints (valid statuses, required fields, slug uniqueness, no empty titles, valid priorities).
- **Slug generation** with Unicode normalization and collision handling.
- **Layout management** — `reorderTask` writes both the task file (when status changes) and `layout.json`; `deleteTask` prunes the slug from every column. Modern layout writes leave `config.json` byte-identical, while the first legacy write removes only `config.layout`. Layout writes never retain an entry for `done_column`, whose order is derived from task timestamps.
- Provide the programmatic API (`createTask`, `updateTask`, `moveTask`, `reorderTask`, `deleteTask`, `listTasks`, `loadConfig`, `validateConfig`, `initProject`) that all consumers build on.

**Validation behavior:**

Consistent with "strict on write, graceful on read":

- **Known fields with invalid values** (e.g., `status: nonexistent-column`) — rejected on write, returned with a validation warning on read.
- **Unknown frontmatter fields** — preserved and passed through with a warning. Core never strips data it doesn't recognize.

**Timestamps.** Core normalizes YAML-parsed dates back to ISO strings on read (gray-matter's `js-yaml` deserializes unquoted ISO timestamps as `Date` objects; we coerce back so consumers see strings consistently).

**`GitHubAdapter` scope in the current architecture.** Only Harbor uses this adapter, and only for reads — it holds it as `ReadableStorageAdapter`. The concrete `writeFile` / `writeFiles` methods were built for Harbor's onboarding flows (seed commits, workspace init, config recovery), which are now deferred; no consumer calls them today. Ongoing task CRUD never routes through `GitHubAdapter` — Harbor is read-only. Delete is not implemented on `GitHubAdapter` at all — the read-only interface it exposes doesn't require it, and no consumer would ever call it.

(File watching is a consumer concern — the CLI implements its own watcher and forwards events through `onTasksChanged`. Core does not need a `watch` primitive.)

---

### 3. Board UI (`@shipbench/board`)

A standalone kanban board app. Published to npm for convenience rather than public use — the CLI needs its standalone bundle at runtime, and an out-of-repository host such as Harbor needs the compiled library resolvable.

**Two mount entries:**

```tsx
// React component — what Harbor consumes
<Board api={api} />;

// Imperative wrapper — what the CLI's static bundle uses
createBoard(rootElement, { api });
```

`createBoard` is a thin wrapper around `createRoot().render(<Board api={api} />)`.

**Distribution.** `vite build` produces the standalone static app served by `shipbench board` (`dist/standalone.html` + assets). The React library export currently points at source (`.` → `./src/index.tsx`); consumers need a TS+JSX toolchain (Harbor's Astro/Vite qualifies). A proper compiled library output lands closer to the first publish — see the top-level Distribution section for the broader shape.

**Board API contract.** This interface is owned by `@shipbench/core` and re-exported from the Board:

```typescript
interface BoardAPI {
  /** When true, the Board hides create/edit/drag affordances and renders a viewing experience only. */
  readonly readOnly?: boolean;

  getConfig(): Promise<ShipbenchConfig>;
  listTasks(): Promise<TaskReadResult>;
  createTask(title: string, fields?: Partial<TaskFrontmatter>): Promise<Task>;
  updateTask(
    slug: string,
    fields: Partial<TaskFrontmatter>,
    body?: string,
  ): Promise<Task>;
  addComment(slug: string, text: string): Promise<Task>;
  editComment(slug: string, index: number, text: string): Promise<Task>;
  deleteComment(slug: string, index: number): Promise<Task>;
  moveTask(slug: string, toStatus: string): Promise<Task>;
  reorderTask(
    slug: string,
    toStatus: string,
    position: number,
  ): Promise<{
    task: Task;
    layout: BoardLayout;
  }>;
  deleteTask(slug: string): Promise<void>;

  // Optional — implemented by the CLI's local server, not by Harbor's
  // remote read-only adapter.
  onTasksChanged?(callback: () => void): () => void;
}
```

`reorderTask` is the primary mutation path: cross-column moves and within-column reorders both flow through it. `moveTask` is kept as a convenience and delegates internally. `onTasksChanged` enables live watch mode when available (local CLI serving) and degrades to polling when not (Harbor's remote mode).

**`readOnly`.** When the host (Harbor in remote mode) provides a `BoardAPI` with `readOnly: true`, the Board:

- Hides the "New task" button.
- Renders the title/body/metadata fields as non-editable text.
- Hides the Task Updates composer and per-entry edit/delete controls.
- Removes drag affordances; cards open detail on click.
- Hides the delete action.
- Hides the archive action, undo, and archive view.

The mutation methods can still be implemented (or stubbed to reject) — the Board simply won't call them.

**Board modes** (data flow at runtime):

| Mode       | Who hosts the Board | BoardAPI source              | Writable?             | When                                                    |
| ---------- | ------------------- | ---------------------------- | --------------------- | ------------------------------------------------------- |
| Standalone | CLI's local server  | `FsAdapter` directly         | Yes                   | `shipbench board`, no Harbor involved.                  |
| Remote     | Harbor              | `GitHubAdapter` (reads only) | No (`readOnly: true`) | Hosted Harbor displaying a project board from a repo.   |

**Stack and design decisions** (full detail in [docs/board/design.md](board/design.md)):

- React 19 + Vite, Tailwind 4, dark-only theme tokens. Zustand for state; `<DragOverlay>` + `@dnd-kit/sortable` for drag-and-drop with within-column ordering. Radix Dialog/Select primitives, lucide-react icons, sonner toasts, react-markdown view + plain `<textarea>` for editing.
- Header is a single sticky row: breadcrumb on the left (`{project.name} › Tasks` or `… › Tasks › {task.title}`), search + new-task + sync on the right. No ShipBench-branded chrome in the Board itself — the host names the context.
- Detail view is a Linear-style in-place swap (not a side panel). ESC or clicking the "Tasks" breadcrumb exits.
- Sync model converges three triggers on one `refresh()`: 60s polling when tab is visible, on-focus refresh via `visibilitychange`, and a manual sync button. `onTasksChanged` short-circuits polling when available.
- Optimistic updates everywhere with snapshot + rollback. Failures revert state, show a `sonner` toast, and trigger a CSS shake on the affected card.

**Watch mode:** When served locally (via CLI), the Board reflects file changes in near-real-time via `onTasksChanged`. If a task file is modified outside the Board (by an agent, a text editor, or a Git pull), the Board updates without a manual refresh.

_Open questions:_

- A few UX limitations are documented in [docs/board/design.md](board/design.md) under "Known UX limitations" (assignee combobox, tag chip input, drag-to-scroll). Not blockers, revisit after real-world use.

---

### 4. CLI (`shipbench`)

A terminal tool for scaffolding and managing ShipBench projects locally.

**Commands:**

- `shipbench init [-n, --name <name>]` — Creates `.shipbench/` with `config.json`, an empty `layout.json`, `README.md`, `AGENTS.md`, and a `welcome-to-shipbench.md` starter task when the project is absent. It leaves a valid existing project byte-for-byte unchanged. Default `name` is the basename of the current directory. Fully standalone — no network, no Harbor dependency.
- `shipbench init --harbor=<connect-url>` — Safely initializes when needed, then connects the repo's normalized GitHub origin to a Harbor project through a signed one-time URL. It uses the same non-interactive connection path as `shipbench connect`.
- `shipbench connect --harbor=<connect-url>` — Connects an existing ShipBench project to Harbor without changing project files. Harbor presents this explicit form for repositories that already use ShipBench.
- `shipbench task create <title> [--status] [--assignee] [--priority] [--tags=a,b,c] [--body <text> | --body-file <path>]` — Creates a new slug-based task file, with its description attached when a body is supplied.
- `shipbench task edit <slug> (--body <text> | --body-file <path>)` — Replaces the task's description whole, leaving `created` and the Updates section untouched. An empty body clears the description.
- `shipbench task move <slug> --to=<status>` — Moves a task to a new status (appends to the destination column's layout unless it is `done_column`).
- `shipbench task list [--status] [--assignee] [--priority] [--archived]` — Lists tasks with optional filters; `--archived` lists the archive instead.
- `shipbench task delete <slug>` — Deletes a task file and prunes the slug from layout.
- `shipbench task archive <slug> [--force]` — Moves a task to `tasks/archive/` byte-identical. Blocked (without `--force`) when live tasks depend on a non-done task.
- `shipbench task archive --done [--keep=N]` — Bulk-archives done tasks, keeping the N most-recently-updated. `--keep` defaults to `done_display.max`.
- `shipbench task unarchive <slug>` — Restores an archived task as it was.
- `shipbench board` — Starts a local web server hosting the Board UI with file watching for live updates. Standalone mode.
- `shipbench board terminal [-s <statuses>] [--tag <tag>] [-a <assignee>] [-p <priority>]` — Opens a read-only live board in the current terminal. Aliases: `term`, `tui`.

**Terminal board behavior.** The terminal board enters the alternate screen while
it runs and restores the previous screen on exit. Its responsive layout degrades
in a fixed order: the done column collapses to a status-line count, empty columns
collapse next, and columns then become full-width stacked sections. Widening the
terminal never reveals less. Tasks outside the configured columns collect in an
`UNCATEGORIZED` column, which remains visible at every width.

The initial read may show an error because no valid frame exists yet. After the
first successful read, a config or storage failure keeps the last good frame on
screen and reports the failure on the status line. A task file caught mid-write
does not invalidate the frame; the board repaints and includes the problem in its
warning count.

Auto-generated `--help` and `-v, --version` via commander. Distribution: the CLI bundles `@shipbench/core` and `gray-matter` (CJS) into a single ESM file via tsup, and is installable globally via `pnpm link --global` or npm.

**Harbor opt-in.** Without any `--harbor` flag, the CLI has zero knowledge of Harbor. The `--harbor` family of flags is the only surface where the CLI talks to a hosted service.

**Non-destructive initialization.** Core treats `.shipbench/config.json` as
the initialization marker. An absent project receives the five scaffold
files. A valid config, including a partial config resolved over defaults,
makes initialization a no-op even when `README.md`, `AGENTS.md`,
`layout.json`, or `tasks/` is absent. If the config is absent while another
canonical ShipBench file or task exists, initialization rejects the incomplete
state. Malformed config or layout JSON and resolved config validation errors
also fail before any write. Ordinary task read warnings remain non-blocking.
An explicit `--name` that differs from an existing project name fails instead
of silently ignoring the argument.

**Signed Harbor connection preflight.** Before sending one POST, both commands
validate the connect URL, require the Git worktree root, validate the resolved
ShipBench project, and normalize the `origin` through core's shared GitHub
remote parser. Connect URLs require HTTPS, except that loopback development
may use HTTP; credentials and fragments are invalid. Supported origins are
GitHub HTTPS, scp-style SSH, and `ssh://git@github.com/...`. The CLI makes no
network request when a local precondition fails.

The CLI inspects local Git state without fetching. It warns when
`.shipbench/config.json` is absent from `HEAD`, ShipBench files have
uncommitted changes, the branch has no upstream, or the branch is ahead of its
upstream. These conditions do not block connection because Harbor supports the
intermediate connected-but-not-yet-pushed state.

The CLI never retries the POST automatically or prints or persists the signed
URL. Exit `0` means success or a confirmed idempotent replay; `2` means usage
or a local precondition failed before the POST; `3` means Harbor definitively
rejected the request; `4` means the remote result is unknown because of a
transport failure, malformed response, or server error. After exit `4`, the
user must inspect Harbor before retrying.

---

### 5. ShipBench Harbor

A web application serving as a solo developer's idea pipeline and project portfolio. Hosted as a deployed, multi-account service so it's reachable from any device — every account is one developer's isolated workspace. Self-hosting is possible but does not unlock a separate "local mode" — when self-hosted, Harbor still uses the same three board modes documented under the Board UI section (Standalone, Remote, Live).

> **Harbor's source lives in a separate, private repository.** This section
> documents Harbor as a product — what it does and why it is shaped this way —
> because Harbor is a real client of the convention and the two are designed
> together. Its implementation details are not part of this repository.

**Positioning: ideas first, project visibility second.** Idea management is Harbor's writable product — the thing a user actually *does* in Harbor. Project boards are read-only visibility: a window, from any device, into work that happens in the repo through the CLI, the local board, and agents. This division is deliberate, not a gap. The end state it serves: a developer opens Harbor on their phone to watch the board while agents work the project on their machine. The data model reflects the same split — manual board ordering (`layout`) exists for the human board user; agents order their own work from `depends_on`, `priority`, and column semantics, all of which live in committed task data. The one honest limitation of remote visibility: a board is exactly as fresh as the repo's last push, so agent workflows that commit and push as they move tasks keep the remote view current.

#### Idea Management

- Ideas are organized in a directory/folder UI grouped by status. Statuses are user-configurable — defaults are `spark`, `exploring`, `committed`, `shelved`, but users can create, rename, reorder, and delete status folders with OS-like folder UX (drag ideas between folders, create new folders inline).
- Create, tag, and annotate project ideas with descriptions, tech stack notes, and related ideas.
- Ideas are their own entity in the data model — not a project, not a task. They are the brainstorming layer.

#### Project Management

- Projects are a separate entity linked to an idea (optionally — a project can exist without an originating idea).
- A project record stores the GitHub repo URL once connected.
- A project may exist in an **intermediate state** — created (e.g., promoted from an idea) but with no repo connected yet. Harbor renders a "Connect a repo" prompt for projects in this state instead of a board.
- Once a project has a repo, Harbor renders the Board UI in remote mode (read-only).

#### Project creation flow

Creating a project requires a Git repo eventually, but Harbor allows the project record to exist before the repo is connected. The end-to-end flow:

1. User promotes an idea to a project in Harbor (or creates a project from scratch).
2. Harbor creates a project record with `github_url = null`.
3. Harbor generates a **signed connect URL** and displays two commands: `shipbench init --harbor=<connect-url>` for a new or unknown local state, and `shipbench connect --harbor=<connect-url>` for an existing ShipBench project.
4. The user runs one command from the Git worktree root. Manual public GitHub URL entry remains available as an alternate path when the CLI is unavailable.
5. The CLI safely initializes when needed, validates the local project and normalized GitHub origin, and sends one POST to the signed URL. The URL itself is the credential, so the CLI needs no separate auth step.
6. Harbor associates the project record with the repo and switches to displaying the board.

The intermediate "no repo connected" state is a deliberate design choice — it lets users brainstorm and queue projects in Harbor before committing to a repo, while still preserving the "every active project has a backing repo" invariant once they're actually working.

Both CLI commands consume the same connect endpoint and share one connection implementation. The signed URL is single-use: replaying it against the same repository confirms the original connection rather than repeating it, and pointing it at a different repository is rejected.

Harbor does not require a repository to be unique per account — separate project records may intentionally reference the same GitHub repository.

#### Harbor never writes to GitHub

**Decision (2026-07).** The originally planned one-time setup writes (seed commit, "Initialize ShipBench workspace?", "Recreate Default Config") were dropped so that Harbor never needs write permissions on a user's repositories. Repo setup happens locally instead: run `shipbench init` in the repo and push.

On board open, the core library checks for `.shipbench/config.json`. If it returns a 404, Harbor renders read-only guidance in place of the board — explaining that the repo isn't initialized and pointing the user at `shipbench init` locally. No write affordances are offered.

This is the single most consequential thing to know about Harbor's permissions posture: **login uses GitHub OAuth through Clerk with low-privilege scopes (`read:user`, `user:email`), board reads use the signed-in user's OAuth token, and Harbor never asks for repository write access.** Board viewing therefore covers public repositories only.

#### Board Integration

Harbor hosts the Board UI and provides a `BoardAPI` implementation. In MVP, Harbor always operates in **remote mode**:

- `BoardAPI` is backed by `GitHubAdapter` for reads only.
- `readOnly: true` is set on the API; the Board hides all create/edit/drag affordances.
- The full kanban view, task detail, breadcrumbs, search, and sync indicators all render — it's a complete viewing experience, just not editable.
- Ongoing task edits happen elsewhere: the CLI for local work, or agents writing directly to files.

#### Tech Stack

Astro on Cloudflare Workers, with Cloudflare D1 for Harbor's own data and Clerk for authentication.

---

## Non-goals

Decisions made against these features. Not "we'll get to them later" — "we've considered them and chosen not to." Listed here so future contributors don't reopen settled questions without new information.

- **Collaboration / teams.** Not a goal. ShipBench targets solo developers — Harbor supports many accounts, but each account is one developer's isolated workspace. (Don't read "solo dev" as "single user" — the auth layer is multi-account by design.) Team features — shared boards, assignees with meaning, permissions — would rewrite the auth model, the file-lock story, and Harbor's whole shape. If the product ever pivots to a team tool, this whole spec changes.
- **Agentic orchestration baked into core.** The project convention (`AGENTS.md`, CLI commands, clean file format) is designed to be agent-friendly by default. Purpose-built agent features layer on through extensible config and external tool definitions (Claude Code skills, MCP servers, etc.) rather than baked-in infrastructure. The agent landscape moves too fast to embed opinions.
- **Bundled platform-specific agent tooling.** Skills / rules for specific agents (Claude Code, Cursor, etc.) live in the ShipBench repo as reference material users can copy — they don't ship in the `shipbench init` scaffold. Every attempted bundle would drift or bloat.
