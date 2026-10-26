# ShipBench — Product Spec

## Motivation

One developer working with AI agents often has several projects moving at once, and the usual ways of tracking that work each have a specific problem. Hosted trackers are built for teams. Every repository needs its own setup, agents reach the plan through an integration, and most of the configuration covers features one person doesn't use. Planning inside the repository fixes access, but a task list has no fields a tool can validate, sequence, or query, and a spec document grows past the point where anyone reads it.

ShipBench uses one Markdown file per task, in a `.shipbench/` directory in the repository. Frontmatter carries the structured fields (status, priority, tags, dependencies), and the body carries whatever context the task needs. Git carries the history, and every client is optional. [Why ShipBench](https://shipbench.dev/docs/why/) has the longer story.

## Overview

ShipBench is a Git-native project management system for solo developers. At its center is a file-based task management convention that lives inside any Git repo. Tasks are Markdown files in a `.shipbench/tasks/` directory, governed by a local config. Any tool that can read and write files — a CLI, a web UI, or an autonomous agent — can interact with the board. The project system is fully self-contained; it does not require any external service.

A core library (`@shipbench/core`) handles task file manipulation for every tool built on the convention, ensuring format consistency regardless of where edits originate. The CLI and the Board UI are built on it.

User-facing surfaces are prefixed with the umbrella name, as in **ShipBench CLI**. The package namespace `@shipbench/*` mirrors this. The naming rules live in [AGENTS.md](../AGENTS.md) under "Naming and branding."

**Domain:** `shipbench.dev` is the official, owned domain.

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
- **`@shipbench/board` publishes for convenience, not for public use.** The CLI depends on it at runtime for the standalone bundle, and any out-of-repository host needs it available on the registry. External consumption is not a supported use case — the version stays 0.x and breaking changes go unremarked.
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

**`name` (required).** The project's display name. Every consumer (the CLI and the Board) reads this field for the breadcrumb root. `shipbench init` defaults it to the basename of the current working directory; `--name "Some Name"` overrides. `name` lives in the project's own metadata for the same reason `package.json#name`, `Cargo.toml#package.name`, etc. do — the project owns its identity, hosts read it.

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

Reads prefer `layout.json`, fall back to the legacy `config.layout` field, then `{}`. A missing file is a valid first-class state; the board uses deterministic fallback ordering. The first layout write in a legacy repo creates `layout.json` and removes only `layout` from `config.json`. Users may gitignore `layout.json` for machine-local order, with the tradeoff that fresh clones render fallback order. Render rules and stale-slug behavior are documented in [docs/board/design.md](board/design.md#task-ordering). Summary:

- Tasks whose slug appears in `layout[columnId]` render in that order.
- Tasks whose status matches a column but whose slug isn't in `layout[columnId]` render below, sub-sorted by `created` desc.
- Slugs in `layout` that don't correspond to any task on disk are ignored at render time, and pruned eagerly on writes that touch that column.
- The Uncategorized column (see below) ignores `layout` entirely and renders by `created` desc.
- The done column (identified by `done_column`) likewise ignores `layout` and renders by `updated` desc (most-recently-touched first). Manual within-column reorder is disabled for done tasks. Cross-column drops into done still work, but no done-column order is recorded; any existing `layout[done_column]` entry is pruned on the next layout write.

**Config resolution.** The core library maintains an internal `DEFAULT_CONFIG` and deep-merges the user's `config.json` over the top of it on read. Partial configs are fully supported — developers can delete any block they don't care about and the system falls back to default behavior. `shipbench init` scaffolds a fully populated config to keep options discoverable.

#### Status conflict handling

**On write: strict.** The core library rejects any task creation or status change that references a column ID not present in `config.columns`, an invalid priority, an empty title, or an empty/whitespace-only `name`.

**On read: graceful.** Tasks with unrecognized statuses (e.g., a column was removed from config, a Git merge introduced tasks from a branch with different columns, or a manual edit has a typo) are not hidden or discarded. The Board UI surfaces them in a catch-all "Uncategorized" column at the trailing edge of the board, making them visible and draggable to a valid column. The core library flags these tasks with a validation warning but still returns them. Never silently lose tasks.

A file whose frontmatter does not parse — malformed YAML such as a duplicated key, or YAML that is a list or bare value rather than `key: value` fields — cannot form a valid `Task`, but it is not dropped either. A listing returns it in `TaskReadResult.unreadable` as an `UnreadableTaskFile`: its slug, path, the whole file verbatim, and a one-sentence reason naming the file line where it can. It also adds a `frontmatter` warning. The same rule applies to live and archived listings. Single-task reads and every mutation throw `UnreadableTaskError`, whose message names the task and the file and whose `file` carries the same record, so nothing writes to the file until someone repairs it by hand. The Board renders these files in a read-only Unreadable column, and `task list` and `task search` print them beside the tasks.

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
| `flag`     | No       | User/agent                                           | A one-line reason, or `true`. Asks for attention in any column. See **Flags** below.                             |
| `created`  | Yes      | Core library (auto-set on creation, immutable)       | ISO 8601 timestamp.                                                                                              |
| `updated`  | Yes      | Core library (auto-set on mutation)                  | ISO 8601 timestamp.                                                                                              |

The description above `## Task Updates` is freeform Markdown. `createTask` takes it as an optional body, `updateTask` replaces it, and both refuse a body carrying an unfenced `## Task Updates` heading or leaving a code fence open — serialization writes the body verbatim, so the first would silently file part of the description as comments on the next read and the second would swallow the real marker into a code block, hiding every entry. Core parses the reserved trailing section into `Task.comments: { timestamp, text }[]`; the Board renders it separately from the editable description. `addComment` and `shipbench task comment` append entries with the current ISO 8601 timestamp; the CLI takes the text positionally, from `--body`, or from `--body-file`, the same way `task create` and `task edit` take a description. Only a line-initial unfenced `### <ISO 8601 timestamp>` opens an entry, so headings inside an entry are prose; text that would read back as structure — a `## Task Updates` heading, a line-initial heading whose text is a date, or an unclosed code fence — is rejected on write rather than left to fail on the next read. `editComment` changes an entry's text by zero-based index without changing its timestamp; `deleteComment` removes an entry by index. Both mutations update the task's `updated` timestamp. Git preserves the earlier text or deleted entry as the audit and recovery trail.

A malformed Updates section never drops the task or throws during reads. Core keeps the split it has already computed: `Task.body` stays the description above the marker, and the section itself is quarantined verbatim on `Task.unreadableUpdates` alongside the reason it would not parse. `comments` is empty beside it, writes serialize the section back byte-identical, and reads add an `updates` validation warning — `unreadableUpdatesWarning` builds that warning from a single task, so `getTask` callers can report it without a directory read. Comment mutations reject an unreadable section until the user repairs the Markdown; the repair is a text edit in the file, and the warning names the offending line. Unknown frontmatter fields are likewise preserved with a warning (so typos like `proirity` surface to the UI without losing data).

Updates are a curated record of facts whose meaning depends on when they happened: decisions, pivots, scope changes, and external events. Ask whether a fact would remain true or relevant regardless of when it happened. If yes, edit the description in place; if the moment matters, append an Update. This is guidance, not a schema rule. Core stores `{ timestamp, text }` and never judges entry prose, so developers may use the section as a general comments log.

**Flags.** `flag` marks a task for attention without moving it: a one-line reason, or `true` when there is none to give. The field is generic on purpose. What a flag means (blocked, needs a decision, needs review) is each project's call, and an agent flagging the task it is stuck on is one use, not the definition. It is informational like `assignee`: nothing gates on it, and nothing sets or clears it as a side effect of another write, so a move to `done_column` leaves it in place. Writes are strict (a blank or multi-line reason, or any value other than a string or `true`, is rejected; `undefined` clears it). Reads are graceful: any other value reads as unflagged, with a `flag` validation warning. `taskFlag` and `isTaskFlagged` are the one reading of the field. They live in the pure `@shipbench/core/flag` subpath, so the Board's cards and counts and the CLI's `--flagged` filter agree. A flag is not `--blocked`, which means unmet `depends_on`.

#### Task archiving

Any task can be archived — done tasks are just the bulk case. Archiving moves the file byte-identical to `.shipbench/tasks/archive/<slug>.md`: frontmatter (including `status`) and timestamps are untouched, so unarchiving restores the task exactly as it was.

- **Invisible to the hot path.** Normal reads never see the archive — both adapters' directory listings exclude subfolders, so `listTasks`, board loads, and search cost nothing extra. The archive is read only on explicit request: `listArchivedTasks`, `task list --archived`, or the Board's archive view (which fetches lazily on first open).
- **Search never reaches the archive.** Board search scans loaded live tasks; the zero-results state says so and links to the archive view. Retrieval paths are the archive view and `task list --archived`.
- **Sort order.** Archive listings sort by `updated` desc — the same key as the done column, so the capped done column and the archive read as one continuous timeline. There is deliberately no `archived_at` field: it would break the byte-identical round-trip, and Git already records filing time (`git log --diff-filter=A -- .shipbench/tasks/archive/`).
- **Slug namespace is unique across live + archive.** New tasks cannot reuse an archived slug (collision handling appends numeric suffixes as usual), so unarchive can never collide and `depends_on` references stay unambiguous forever.
- **Dependents guard.** Archiving a task in `done_column` — or one no live task depends on — is silent. Archiving a non-done task with live dependents throws `ArchiveBlockedError` (listing the dependents) unless forced: `--force` in the CLI, a confirm dialog listing dependents in the Board. Consequently an archived `depends_on` entry counts as satisfied — it is either genuinely done or was force-archived deliberately.
- **Ownership.** Archiving happens through the CLI and the writable Board (detail-view action with undo toast; archive view for browse/restore). A `readOnly` Board never archives. Nothing archives automatically; bulk archiving is always an explicit command.

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

**Adapter pattern.** Core defines a two-tier adapter surface and ships one built-in implementation:

- **`FsAdapter`** — Full read/write/delete on the local filesystem. Implements the full `StorageAdapter` interface. Used directly by the CLI.

It is exported directly from `@shipbench/core`. The surface is intentionally minimal so other hosts can supply their own adapter.

**Adapter interfaces:**

```typescript
// Read-only surface — the type held by consumers that only display data
// (e.g. the CLI's terminal views). Statically prevents write attempts.
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

(File watching is a consumer concern — the CLI implements its own watcher and forwards events through `onTasksChanged`. Core does not need a `watch` primitive.)

---

### 3. Board UI (`@shipbench/board`)

A standalone kanban board app. Published to npm for convenience rather than public use — the CLI needs its standalone bundle at runtime, and an out-of-repository host needs the compiled library resolvable.

**Two mount entries:**

```tsx
// React component — what an embedding host consumes
<Board api={api} />;

// Imperative wrapper — what the CLI's static bundle uses
createBoard(rootElement, { api });
```

`createBoard` is a thin wrapper around `createRoot().render(<Board api={api} />)`.

**Distribution.** `vite build` produces the standalone static app served by `shipbench board` (`dist/standalone.html` + assets). The React library export currently points at source (`.` → `./src/index.tsx`); consumers need a TS+JSX toolchain. A proper compiled library output lands closer to the first publish — see the top-level Distribution section for the broader shape.

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

  // Optional — implemented by the CLI's local server. Hosts without a
  // change feed omit it.
  onTasksChanged?(callback: () => void): () => void;
}
```

`reorderTask` is the primary mutation path: cross-column moves and within-column reorders both flow through it. `moveTask` is kept as a convenience and delegates internally. `onTasksChanged` enables live watch mode when available (local CLI serving) and degrades to polling when not.

**`readOnly`.** When a host provides a `BoardAPI` with `readOnly: true`, the Board:

- Hides the "New task" button.
- Renders the title/body/metadata fields as non-editable text.
- Hides the Task Updates composer and per-entry edit/delete controls.
- Removes drag affordances; cards open detail on click.
- Hides the delete action.
- Hides the archive action, undo, and archive view.

The mutation methods can still be implemented (or stubbed to reject) — the Board simply won't call them.

**Hosting.** `shipbench board` serves the standalone bundle from the CLI's local server, backed by `FsAdapter` and writable. Any other host embeds the React component with its own `BoardAPI`, writable or `readOnly`.

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

**Finding the board.** Every command except `init` uses the nearest directory at or above the current one that holds `.shipbench/`. The search stops at the first `.shipbench/` it reaches (one without `config.json` is reported as missing rather than skipped) and at the first `.git` entry, which marks the top of a repository, linked worktree, or submodule. Writes resolved to a board above the current directory name it on stderr. The global `-C <path>` names the board directory exactly and never searches. `init` never searches; it notes a board above it in the same checkout and creates the new one anyway.

**Commands:**

- `shipbench init [-n, --name <name>]` — Creates `.shipbench/` with `config.json`, an empty `layout.json`, `README.md`, `AGENTS.md`, and a `welcome-to-shipbench.md` starter task when the project is absent. It leaves a valid existing project byte-for-byte unchanged. Default `name` is the basename of the current directory. Fully standalone — no network.
- `shipbench task create <title> [--status] [--assignee] [--priority] [--tags=a,b,c] [--body <text> | --body-file <path>]` — Creates a new slug-based task file, with its description attached when a body is supplied.
- `shipbench task edit <slug> [description] [metadata]` — Revises the description (`--body` / `--body-file`, replaced whole; empty clears it) and/or the validated metadata: `--title` (never renames the file), `--priority`, `--assignee` / `--clear-assignee`, `--tags` / `--add-tag` / `--remove-tag` / `--clear-tags`, `--depends-on` / `--add-depends-on` / `--remove-depends-on` / `--clear-depends-on`. Every change is one `updateTask` call, so core validation runs before any write and a rejected value leaves the task untouched. `created` and the Updates section stay untouched; `status` and placement stay with `task move`.
- `shipbench task flag <slug> [reason]` / `shipbench task unflag <slug>` — Sets, rewords, or clears a task's flag through `updateTask`. A flag that already says the same thing, or an unflag on a task with no `flag` field, writes nothing.
- `shipbench task move <slug> --to=<status>` — Moves a task to a new status (appends to the destination column's layout unless it is `done_column`).
- `shipbench task list [--status] [--assignee] [--priority] [--tag] [--flagged] [--available | --blocked] [--archived]` — Lists tasks with optional filters, marking flagged tasks in text output; `--archived` lists the archive instead. `--status`, `--assignee`, and `--priority` accept a comma-separated or repeated list and match any listed value; an unconfigured `--status` or `--priority` value is an error, not an empty result.
- `shipbench task search <query> [--status] [--assignee] [--priority] [--tag=a,b] [--flagged] [--available | --blocked] [--whole-word] [--archived | --all] [--limit <n>] [--json] [--include-body]` — Full-text search over the corpus defined under **Search** below. `--archived` searches the archive instead of live tasks, `--all` searches both. The metadata and availability flags share `task list`'s predicate and semantics.
- `shipbench task delete <slug>` — Deletes a task file and prunes the slug from layout.
- `shipbench task archive <slug> [--force]` — Moves a task to `tasks/archive/` byte-identical. Blocked (without `--force`) when live tasks depend on a non-done task.
- `shipbench task archive --done [--keep=N]` — Bulk-archives done tasks, keeping the N most-recently-updated. `--keep` defaults to `done_display.max`.
- `shipbench task unarchive <slug>` — Restores an archived task as it was.
- `shipbench board` — Starts a local web server hosting the Board UI with file watching for live updates. Standalone mode.
- `shipbench board terminal [-s <statuses>] [--tag <tag>] [-a <assignee>] [-p <priority>] [--flagged]` — Opens a read-only live board in the current terminal. Aliases: `term`, `tui`. A flagged task carries a `!` marker (warning colour; dim on a done task), and the status line counts live flags.

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

**Search.** `searchTasks` in `@shipbench/core` is the shared lexical retrieval
contract. The CLI and the Board both call it: the CLI over the location it was
asked for, the Board over its loaded live tasks (see **On the Board** below). It
is lexical only — no
account, no model service — and stays that way unless measured misses justify a
separate investigation.

- **Corpus.** A query splits on whitespace; every term must occur, as a
  case-insensitive substring, somewhere in a task's title, a tag, the Markdown
  description, or a **Task Updates entry** — including a quarantined unreadable
  Updates section. Terms may land in different parts of the corpus and in any
  order. Recording a decision in an Update is therefore enough to retrieve it
  later.
- **Precision controls (opt-in).** Both narrow the term-matching rule and leave
  the corpus, ordering, and result context untouched. A double-quoted run in the
  query — `"token exchange"` — is one term that must match contiguously, with
  internal whitespace matching any whitespace run so a phrase survives a line
  break; an empty or unbalanced quote is dropped. `--whole-word` matches every
  term (loose or quoted) on word boundaries, so `ci` stops matching `decision`.
  The grammar lives in `searchTasks`, so the Board's search field accepts the
  same quoted phrases; it has no whole-word control. The CLI
  passes literal quote characters through in the `<query>` argument, so a phrase
  has to be protected from the shell (`task search '"token exchange"'`).
- **Result context.** Each match reports `slug`, `title`, current `status`,
  `location` (`live` / `archive`, supplied by the caller), and `matched_fields`
  (`title` / `tags` / `body` / `updates`). A body hit adds a bounded `snippet`.
  An Updates hit adds `update_matches`: a readable entry carries its zero-based
  `index`, ISO `timestamp`, and an excerpt so the source is retrievable exactly;
  an unreadable section carries `{ unreadable: true, snippet }`.
- **Reading a result as history.** Search never asserts that a matched decision
  is still in force. It returns `status` and the Update `timestamp` and leaves
  the judgment to the reader; output carries no "current" or "decided" labels.
- **Ordering — relevance.** `searchTasks` ranks its results; it no longer
  preserves input order. Each matched field contributes a weight (title, then
  tags, then body, then Updates) scaled by how many query terms that field
  covers, so a task carrying more of the query in a stronger field ranks higher.
  Ties break toward the more recently `updated` task, then fall back to the
  caller's input order. Ranking lives in `searchTasks` itself. The Board
  deliberately does not apply it: a column's order is its manual layout (or
  `updated` desc in the done column), and search only hides the cards that do
  not match.
- **Omitted matches.** `--limit` still truncates, but no longer silently. JSON
  carries `total_matches` (the count before the limit); text output ends with a
  `… N of M matches not shown (raise --limit)` line whenever the limit drops any
  match, including `--limit 0`.
- **Narrowing the corpus.** `task search` takes `task list`'s own filters —
  `--status`, `--assignee`, `--priority` (comma or repeated, matching any listed
  value), `--tag` (comma or repeated, AND semantics), and `--available` /
  `--blocked` — applied to the candidate set before `searchTasks` runs, reusing
  the `listAvailableTasks` / `listBlockedTasks` helpers verbatim. An unconfigured
  `--status` or `--priority` value is an error rather than an empty result.
  `--available` excludes `--blocked`;
  availability is a live-column concept and cannot combine with `--archived` /
  `--all`. Filtering only narrows which tasks are searched; it never changes the
  relevance ordering above.
- **On the Board.** The search field runs `searchTasks` over the loaded live
  tasks, with each card's slug and assignee added to the corpus. Those two are
  printed on every card, and board search matched them before it matched
  descriptions, so those lookups keep working. When some term appears only in a
  task's description or Updates, the card shows where it was found: the body
  snippet, or else the first matching Update's excerpt with its timestamp, plus
  a count of any other matching Updates. A card whose title, slug, assignee, or
  tags already show every term adds nothing. The zero-result state names the
  corpus and, where the host has an archive view, says archived tasks are not
  searched and offers the archive filter. That filter runs the same search over
  the archive the view has already fetched, with the saved status added to the
  corpus.
- **Staged, not in this increment.** Semantic retrieval — a dedicated task.

**No network.** The CLI makes no outbound network requests. Everything it does is against the local repository, and `shipbench board` listens on `127.0.0.1` only.

**Non-destructive initialization.** Core treats `.shipbench/config.json` as
the initialization marker. An absent project receives the five scaffold
files. A valid config, including a partial config resolved over defaults,
makes initialization a no-op even when `README.md`, `AGENTS.md`,
`layout.json`, or `tasks/` is absent. If the config is absent while another
canonical ShipBench file or task exists, initialization rejects the incomplete
state. Malformed config or layout JSON and resolved config validation errors
also fail before any write. Ordinary task read warnings remain non-blocking.
An explicit `--name` that differs from an existing project name fails instead
of silently ignoring the argument. Every refusal exits `2` without writing.

---

## Non-goals

Decisions made against these features. Not "we'll get to them later" — "we've considered them and chosen not to." Listed here so future contributors don't reopen settled questions without new information.

- **Collaboration / teams.** Not a goal. ShipBench targets solo developers. Team features — shared boards, assignees with meaning, permissions — would need an auth model and a file-lock story ShipBench deliberately doesn't have. If the product ever pivots to a team tool, this whole spec changes.
- **A hosted client.** ShipBench has no account, server, or hosted web app. An earlier design, ShipBench Harbor, paired a hosted idea store with read-only views of pushed boards. It was [retired before launch](../.shipbench/tasks/archive/spike-define-harbor-s-contribution-to-choosing-and-resuming-projects.md): the boards it could show were limited to public repositories and as stale as the last push, while working locally already sees uncommitted work in private repositories. Viewing a board away from the machine is covered by the repository host's own file view. Tools that span several repositories can be built on the published packages without becoming part of ShipBench.
- **Agentic orchestration baked into core.** The project convention (`AGENTS.md`, CLI commands, clean file format) is designed to be agent-friendly by default. Purpose-built agent features layer on through extensible config and external tool definitions (Claude Code skills, MCP servers, etc.) rather than baked-in infrastructure. The agent landscape moves too fast to embed opinions.
- **Bundled platform-specific agent tooling.** Skills / rules for specific agents (Claude Code, Cursor, etc.) live in the ShipBench repo as reference material users can copy — they don't ship in the `shipbench init` scaffold. Every attempted bundle would drift or bloat.
