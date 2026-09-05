# Board UI — Design

The Board UI (`@shipbench/board`) is the kanban surface. It is consumed by:

- the CLI (`shipbench board`), which serves it as a static bundle pointed at a local HTTP server, and
- Harbor, which embeds it as a React component pointed at the GitHub API.

The Board never imports adapters or business logic from `@shipbench/core` — only types (`BoardAPI`, `Task`, `ShipbenchConfig`).

## Stack

| Concern | Choice |
|---|---|
| Framework | React 19 |
| Bundler | Vite |
| Styling | Tailwind, dark-only tokens per [docs/design-doctrine.md](../design-doctrine.md) (CSS variables as the seam for a future theme toggle) |
| State | Zustand (single store) |
| Drag and drop | `@dnd-kit/core` + `@dnd-kit/sortable` (manual within-column ordering; see "Task ordering" below) |
| Markdown view | `react-markdown` |
| Markdown edit | Hand-rolled `<textarea>` — monospace, comfortable line-height, tab inserts spaces, auto-expanding height |
| Icons | Radix Icons (`react-icons/rx`) for semantic actions; the doctrine's chevron primitive (local `#sb-chev` symbol) for pointing/gauge marks. The Board has no fold/unfold toggles, so it declares no `#disc`. |
| Toasts | `sonner` |
| Primitives | `@radix-ui/react-*` (dialog, dropdown, tooltip — added as needed) |
| Tests | Vitest + `@testing-library/react` |

No router. No global state library beyond Zustand. No CSS-in-JS.

## Mount API

The Board ships two entry points:

```tsx
// React component — what Harbor consumes
import { Board } from '@shipbench/board';
<Board api={api} />

// Imperative wrapper — what the CLI's static bundle uses
import { createBoard } from '@shipbench/board';
createBoard(rootElement, { api });
```

`createBoard` is a thin wrapper around `createRoot(rootElement).render(<Board api={api} />)`. Both paths feed the same component.

## State model

A single Zustand store. The API is the writer of truth, but the store is the read surface for the entire UI — search, filters, and selection all operate against the store, never via fresh API calls.

Store shape (sketch):

```ts
{
  config: ShipbenchConfig | null,
  tasks: Task[],
  warnings: TaskValidationWarning[],
  selectedTaskSlug: string | null,
  searchQuery: string,
  lastSyncedAt: number | null,
  isSyncing: boolean,

  refresh: () => Promise<void>,
  moveTask: (slug, toStatus) => Promise<void>,   // optimistic
  updateTask: (slug, fields, body?) => Promise<void>,  // optimistic
  createTask: (title, fields?) => Promise<void>,  // optimistic
  deleteTask: (slug) => Promise<void>,            // optimistic
  selectTask: (slug | null) => void,
  setSearchQuery: (q: string) => void,
}
```

### Optimistic updates

Every mutation that goes through `BoardAPI` is optimistic. The GitHub adapter has real network latency; the CLI is local but still async. UX cannot wait.

Pattern for every mutation:

1. Snapshot the slice of state about to change.
2. Apply the change to the store immediately (rendering updates).
3. Fire the API call.
4. On success: reconcile the store with the server response (slugs may have collision suffixes, timestamps will be authoritative).
5. On failure: restore the snapshot, fire a `sonner` toast (`toast.error(...)`), and trigger a transient "errorAt" timestamp on the affected card so its element can run a CSS shake animation.

### Search

Search filters tasks **client-side from the store**, not by re-querying the API. Search input is debounced ~200ms before updating `searchQuery` to avoid re-rendering on every keystroke. Match is case-insensitive substring against title, slug, tags, and assignee.

**Search never reaches the archive.** Archived tasks (`tasks/archive/`) are not loaded on the board's hot path, so they cannot match. The zero-results state says so explicitly and links into the archive view, whose own client-side filter covers archived retrieval. The archive view fetches `listArchivedTasks` lazily on first open and lists by `updated` desc — the same sort key as the done column, so the capped done column and the archive read as one continuous timeline (deliberately no `archived_at` field; Git records filing time).

## Sync model

Three triggers, one effect — all converge on `store.refresh()`:

- **Polling**: every 60s when the tab is visible. Pause when hidden.
- **On-focus**: `visibilitychange` → "visible" immediately calls `refresh()`. This handles the case where the developer leaves Harbor to edit a task via CLI or agent, then returns.
- **Manual**: a "Sync" button in the header. Shows `Synced 2m ago` (relative time), click forces `refresh()`.

If `BoardAPI.onTasksChanged` is defined (the CLI's local-server case), it **replaces** the 60s polling — file watcher events drive `refresh()` directly. Focus and manual still apply.

`lastSyncedAt` is updated on every successful refresh and is the only "freshness" indicator.

## Layout

### Header (always present)

A single sticky row across the top of the Board. Breadcrumb on the left, toolbar on the right:

```
┌─────────────────────────────────────────────────────────────────┐
│ {project-name} › Tasks            [search] [+ New] [Synced 2m]  │
└─────────────────────────────────────────────────────────────────┘
```

- `{project-name}` is `config.name` — every project has one (required field in `ShipbenchConfig`). Clicking it has no effect (it's the root identity, not a navigation step).
- "Tasks" is the only intermediate segment. When detail mode is open it's clickable and closes detail.
- No ShipBench-branded chrome inside the Board — host (CLI tab title, Harbor's page) carries the umbrella identity. Keeps the Board embed-friendly without theming conflicts.

### Board mode (default)

```
┌─────────────────────────────────────────────────────────────────┐
│ Header (above)                                                  │
├─────────────────────────────────────────────────────────────────┤
│ ┌──── To Do ───┐ ┌── In Progress ─┐ ┌──── Done ───┐ ┌── Uncat ─┐│
│ │              │ │                │ │             │ │ (only if││
│ │              │ │                │ │             │ │ needed) ││
│ └──────────────┘ └────────────────┘ └─────────────┘ └─────────┘│
└─────────────────────────────────────────────────────────────────┘
```

Columns are rendered from `config.columns`. The Uncategorized column appears at the trailing edge **only when** at least one task has an unrecognized status — never empty.

### Detail mode

A Linear-style in-place swap. The header stays; the board area becomes the detail surface. The breadcrumb in the header extends with the task title:

```
┌─────────────────────────────────────────────────────────────────┐
│ {project-name} › Tasks › Setup Auth   [search] [+ New] [Synced] │
├──────────────────────────────────────────┬──────────────────────┤
│ Left ~70% — Markdown working area        │ Right ~30% — Meta    │
│                                          │                      │
│   [View: rendered]                       │ Status:   [dropdown] │
│      or                                  │ Priority: [dropdown] │
│   [Edit: monospaced textarea]            │ Assignee: [input]    │
│                                          │ Tags:     [chips]    │
│                                          │                      │
│                                          │ Created: 2 days ago  │
└──────────────────────────────────────────┴──────────────────────┘
```

Detail mode is driven by `selectedTaskSlug` — there is no internal route. Harbor can lift this to its own URL via props for deep linking; the CLI doesn't bother.

The left pane renders parsed Task Updates below the editable description as a separate chronological timeline. Each entry shows a locally formatted timestamp in mono, exposes the exact ISO 8601 value on hover, and renders its Markdown text in the normal reading face. The Board does not merge Task Updates back into the description editor. In writable mode, a compact composer appends through `BoardAPI.addComment`, and per-entry controls edit text or confirm deletion through zero-based indices. Core supplies and preserves the authoritative timestamp. Read-only hosts render no mutation controls.

When core reports the section as unreadable (`Task.unreadableUpdates`), the pane shows that instead of an empty timeline: the count reads `unreadable`, the reason is announced as an alert, and the preserved text is displayed verbatim in a `pre` — not through `Markdown`, because rendering it would hide the markup that broke the parse. The composer is hidden, matching core's refusal to mutate the section until it parses, and the read-only shortcut that hides an empty section does not apply. Repair happens in the task file; the Board's job here is to make sure someone knows to open it.

**Closing the detail:** ESC, or clicking the "Tasks" segment in the header breadcrumb. No outside-click — there is no "outside" since the detail fills the board area. No close X in a corner either; the breadcrumb is the discoverable back affordance.

### Markdown links

Descriptions and Task Updates render through one `Markdown` component (`ui/Markdown.tsx`), so both surfaces behave identically. `urlTransform` stays at react-markdown's default — Harbor's content comes from a GitHub repo, so that sanitization matters — and every decision happens in the `a` override, after it.

Task bodies mostly link to files in the same repo, written relative for someone reading the raw Markdown next to a checkout. `utils/links.ts` resolves those to repo-root-relative paths. The convention fixes the base: task files live at `.shipbench/tasks/<slug>.md`. Bare paths (`apps/site/index.astro`) are the one ambiguity — Markdown says file-relative, authors mean repo root, and repo root is what the Board uses.

Four outcomes:

| Link | Behaviour |
|---|---|
| Another live task file | Opens that task in place via `selectTask` — no host involvement |
| Repo file | `BoardAPI.resolveRepoLink(path)` names the destination; opens in a new tab |
| External `http(s)` | New tab, `rel="noopener noreferrer"`, href untouched |
| In-page anchor | Default behaviour |

`resolveRepoLink` is optional, like `onTasksChanged`. Harbor returns a `blob/HEAD` URL on the project's repo. The CLI board omits it — the files are on disk, but an editor deep link assumes an editor and serving them would turn the board server into an arbitrary-repo-file server. Without it, repo links render as plain visible paths, which is honest and still readable.

## Error model

| Failure | UX |
|---|---|
| Optimistic mutation rejected by API | Revert store, toast (`sonner`), shake the affected card or field |
| `refresh()` fails | Toast, leave `lastSyncedAt` untouched, show stale data |
| Initial `getConfig` / `listTasks` fails | Full-screen retry state, not a toast |

## Accessibility

- dnd-kit's keyboard sensor is enabled (space to pick up, arrows to move, space to drop).
- All Radix primitives keep their default focus behavior.
- ESC closes the detail view.
- Color contrast on dark tokens must meet AA at minimum.

## Non-goals (for now)

- Light mode / theme toggle. Dark-only until Harbor gets a design pass.
- URL routing inside Board.
- Filter UI beyond search. Status filter via column visibility, no priority/assignee filters in v1.
- A rich-text editor for the body — `react-markdown` + plain textarea suffices.
- Bulk operations (multi-select, mass move).
- Realtime collaboration. Solo-developer scope.

## Task ordering

Tasks are manually orderable within each column. Order is stored centrally in the machine-managed `.shipbench/layout.json` file — not in human-owned config or per-task frontmatter — so the column's order can be read from a single place and dragging never requires rewriting N task files.

```jsonc
{
  "todo": ["setup-auth", "build-landing"],
  "in-progress": ["design-board"]
}
```

Core reads `layout.json` when present, falls back to the legacy `config.layout` field, then to `{}`. A missing file is valid: unlisted tasks use the deterministic fallback order. The first layout write migrates a legacy config by creating `layout.json` and removing only the old `layout` key. Users may gitignore the file for machine-local ordering, accepting that Harbor and fresh clones will use fallback order.

**Render rules:**

- Tasks whose status matches a column AND whose slug appears in `layout[columnId]` render in that order.
- Tasks with that status but no layout entry render below, sub-sorted by `created` desc (stable tiebreak).
- The Uncategorized column ignores `layout` entirely; tasks render by `created` desc (inbox semantic).
- Slugs in `layout` that don't correspond to any task on disk are ignored at render time and pruned on the next write that touches that column.
- The configured done column is time-sorted by `updated` desc and never records manual order. Drops into done still update task status, while every layout write eagerly removes any existing `layout[done_column]` entry.

**Why centralized in `layout.json` instead of config or per-task frontmatter:**

- One write per reorder, not N.
- A column's order can be inspected and edited as one structure.
- Layout is board-level metadata, not task-level — it travels with the board, not the task.

**Trade-off — non-atomic cross-column moves.** A cross-column drag both flips the task's `status` (a task-file write) AND updates `layout.json`. The two are sequential, not atomic. If the second write fails after the first succeeds, the on-disk state is partial; the store rolls back its optimistic state and toasts an error, but the user will need to manually correct the partial write. For solo dev with `FsAdapter`, this is exceedingly rare; for the GitHub adapter, hosted Harbor MVP is read-only so the path isn't exercised. A future Trees API batch write would tighten this.

**Why this came out of the "must resolve before launch" question.** An earlier draft of this doc deferred the ordering decision, noting that adding a model later (manual order vs. `blocked_by` semantic dependencies) is destructive — boards populated before the change would need migration. The decision was made: manual order via `layout`, with `blocked_by` deferred. Two tasks with identical status + priority that have a meaningful ordering (e.g. dependent work) need *some* way to express it, and a manual order is simpler to implement and reason about than auto-derived dependency order.

## Known UX limitations (deferred, not blockers)

These are deliberate gaps in the first cut. Worth revisiting once we've used the board against real projects for a few weeks.

- **Assignee field is a freeform text input.** Per spec, assignee is "useful for distinguishing human vs. agent work" — a label, not an account reference. Freeform is technically correct, but the lack of any guidance or autocomplete makes it feel unexpected when users land on the detail view. A small helper line and autocomplete from values already used on the board would close the gap.
- **Tags are a comma-separated text input.** Works, but offers no visual affordance that commas are the delimiter. Options: a labeled hint, or a proper chip input (type, press comma/Tab/Enter to commit, backspace to remove).
- **Horizontal scroll on the board only via scrollbar.** Users will likely expect click-and-drag to pan across columns. Easy add via a wheel/pointer handler that pans when the drag isn't over a card.

## Build plan

1. **Scaffold**: Tailwind config with dark tokens, install runtime deps.
2. **Zustand store**: state shape, `refresh()`, optimistic mutation helpers, snapshot/rollback utility.
3. **Board view**: column layout from config, card components, dnd-kit wired to optimistic `moveTask`.
4. **Detail view**: in-place swap on `selectedTaskSlug`, breadcrumbs, 70/30 layout, markdown view/edit toggle, metadata sidebar wired to optimistic `updateTask`.
5. **Header**: search input (debounced), sync button + relative time, "+ New task" affordance.
6. **Sync wiring**: polling + visibilitychange + manual, `onTasksChanged` short-circuit when available.
7. **Toast + shake error path**: shared mutation wrapper, sonner setup, CSS shake animation.
8. **`createBoard` wrapper**: imperative entry for the CLI's static bundle.
9. **CLI integration**: `shipbench board` serves the static bundle, runs a local HTTP server over the `BoardAPI` contract, watches `.shipbench/tasks/` for `onTasksChanged`.
