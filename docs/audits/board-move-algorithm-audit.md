# Board move/reorder algorithm audit

**Date:** 2026-07-25
**Task:** `spike-audit-and-harden-the-board-task-move-algorithm`
**Scope:** every path that mutates a task's position or status — drag reorder,
cross-column drag, detail-panel status change, `layout.json` read/write, the
done-column time-sort override, and the `onTasksChanged` live refresh.
**Method:** read of the full move path across
`packages/board/src/ui/KanbanBoard.tsx`, `packages/board/src/store/boardStore.ts`,
`packages/core/src/tasks.ts`, `apps/cli/src/boardServer.ts`; store-level race
probes run under vitest; mechanism confirmed against the `@dnd-kit/core@6.3.1`
and `zustand@5.0.14` sources in `node_modules`.

> **Status (2026-07-26).** All three recommendations have since landed.
> Request sequencing shipped in `a790bb1`; the preview rebuild (Option A)
> followed. The damping described in §4 has been removed — it was a guard rail
> for a loop that is now structurally impossible. Sections below are preserved
> as the original findings.
>
> **Status (2026-07-30).** The ordering consolidation landed too, closing **B4**
> and the "ordering logic exists in three places" seam in §3. The shape differs
> from the §5 proposal: rather than a `MoveIntent`/`applyMove` reducer living in
> the Board and tested against core, the pure layout algebra moved *into* core as
> `packages/core/src/layout.ts` (`layoutAfterMove`, `layoutWithoutTask`,
> `orderedTasksForColumn`) and both core and the Board now call it. There is no
> mirror left to test for agreement. `orderedTasksForColumn` takes `done_column`
> as a **required** argument, so B4 is a compile error rather than a convention.
> The `MoveIntent` union was deliberately skipped — with the algebra shared, each
> hand-splicing call site collapses to a single call.
>
> **Every code reference below points at the pre-fix tree.**
> `computeOptimisticLayout`, `removeSlugFromLayout`, `layoutWithoutSlug`, and the
> Board's `getOrderedTasksForColumn` no longer exist, and the line numbers have
> moved. Read this document as a dated record of the original findings, not as a
> map of the current code.

---

## Verdict

**Rebuild the drag-preview layer; patch the store in place.**

The React #185 crash is not a stray missing guard. It is structural: the drag
preview is *reflexive* — it mutates the very geometry that produces it. No
number of hover guards closes it, because every guard only covers one face of a
feedback loop that has arbitrarily many. The three fixes landed with this audit
damp the loop and remove its amplifiers; they stop the crash but do not remove
the reflexivity.

The store's ordering logic, by contrast, is basically sound. Its defects are
ordinary concurrency bugs — missing request sequencing — and are worth fixing
in place rather than rewriting.

---

## 1. Root cause of the #185 crash

**Minified React error #185 is "Maximum update depth exceeded."** React throws
it when nested updates exceed 50 in a single commit cycle.

### The loop

Three facts, each verified in source:

1. **dnd-kit derives `over` during render.** `core.esm.js:2985-2992` computes
   `collisions` from `droppableRects` + `pointerCoordinates` in the render body,
   then `const overId = getFirstCollision(collisions, 'id')`.
2. **dnd-kit dispatches `onDragOver` from an effect keyed on that id.**
   `core.esm.js:3244-3284` — `useEffect(() => { ...onDragOver(event) }, [overId])`.
3. **Our `onDragOver` changes the geometry that step 1 measures.**
   [KanbanBoard.tsx:109-139](packages/board/src/ui/KanbanBoard.tsx#L109-L139)
   projects the dragged card *into* the destination column and *out of* the
   source column. Both columns change height. Every card below the insertion
   point moves.

So: `overId` changes → effect → `setPreviewStatus`/`setPreviewPosition` →
re-render → columns reflow → different element under a **stationary** pointer →
`overId` changes → effect → … Each cycle is a nested update. Past 50, React
throws #185.

### Why the existing guard didn't hold

[KanbanBoard.tsx:186](packages/board/src/ui/KanbanBoard.tsx#L186) already
carries this comment:

> dnd-kit then fires onDragOver with over.id === active.id, which would
> invalidate our position and cause a **ping-pong between two states**.

That is the same loop, diagnosed correctly and patched on exactly one face —
the pointer landing on the projected placeholder. At least two other faces stay
open:

- **The null-over face.** Pointer parks in the gap between cards, or in column
  padding. `over` goes null → `setPreviewStatus(null)` → projection is
  *removed* → cards slide back → pointer is over a card again → projection
  returns → cards slide away → `over` null again. A clean two-state
  oscillation, no exotic layout required.
- **The cross-column face.** The projection changes the tallest column, which
  changes board height, which can add or remove the horizontal scrollbar,
  which shifts every column's rect. `pointerWithin` then flips between two
  adjacent columns.

The guard's existence is itself the strongest corroboration: someone hit this
loop, correctly identified it as a ping-pong, and patched the instance in front
of them. The class was never addressed.

### Why it presents as transient

It requires the pointer to come to rest within roughly a card-shift of a
boundary. Move continuously and you never trip it; hesitate over the wrong
pixel and the board dies. That matches the reported "several transient bugs,
including a hard crash."

---

## 2. Confirmed bugs

Severity: **S1** user-visible breakage · **S2** wrong/lost data · **S3** visual
or consistency defect.

### B1 (S1) — Maximum update depth exceeded during drag

Section 1. **Fixed** (damped) — see §4.

### B2 (S1) — A live refresh mid-move reverts the card, then it jumps back

*Proven by probe.* [boardStore.ts:127-168](packages/board/src/store/boardStore.ts#L127-L168)
writes optimistic state, then awaits `api.reorderTask`. `refresh()`
([boardStore.ts:91-120](packages/board/src/store/boardStore.ts#L91-L120))
blind-overwrites `tasks` and `config` with whatever the server had. Neither
knows about the other — there is no generation counter, no in-flight guard, no
request sequencing anywhere in the store.

Probe result, moving `a` from `todo` to `doing` with the POST still in flight:

```
after refresh:  status of a = todo   layout = {"todo":["a","b","c"]}   ← reverted
after POST:     layout = {"todo":["b","c"],"doing":["a"]}              ← jumps back
```

**This is not a rare race under the CLI.** `shipbench board` watches
`.shipbench/tasks`, `config.json`, and `layout.json`
([boardServer.ts:518-535](apps/cli/src/boardServer.ts#L518-L535)). Core's
`reorderTask` *always* writes `layout.json`
([tasks.ts:729-753](packages/core/src/tasks.ts#L729-L753)). So the board's own
move trips its own watcher and broadcasts `tasks-changed` 150 ms later, and
`SyncEffects` turns that into a full `refresh()`
([SyncEffects.tsx:24-36](packages/board/src/ui/SyncEffects.tsx#L24-L36)). Every
move self-triggers a refresh. Rapid successive moves put one squarely inside
the next move's in-flight window.

**Not fixed** — needs request sequencing. See §5.

### B3 (S2) — A failed move discards server results that landed after it

`snapshotState` captures the *entire* `tasks` array and `config` at call time
([boardStore.ts:718-724](packages/board/src/store/boardStore.ts#L718-L724)), and
`rollback` restores them wholesale
([boardStore.ts:742-769](packages/board/src/store/boardStore.ts#L742-L769)).

With two overlapping moves, if the second fails, its rollback reinstates a
snapshot that predates the first move's *server-authoritative* task and layout,
silently replacing them with the first move's optimistic guess. Core's
`reorderLayout` self-heals stale layouts by materializing leftovers
([tasks.ts:759-802](packages/core/src/tasks.ts#L759-L802)), so the authoritative
layout routinely differs from the optimistic one — the discard is real, not
theoretical.

Rollback should be scoped to the slug it owns, not the whole board.

### B4 (S3) — Detail-panel j/k navigation disagrees with the board in the done column

[DetailView.tsx:77-82](packages/board/src/ui/DetailView.tsx#L77-L82) calls
`getOrderedTasksForColumn(tasks, config.layout, columnId, validStatuses)` —
**omitting the `doneColumnId` argument.** The board passes it
([KanbanBoard.tsx:74-80](packages/board/src/ui/KanbanBoard.tsx#L74-L80)).

The parameter is what selects the `updated`-desc time-sort
([boardStore.ts:629-634](packages/board/src/store/boardStore.ts#L629-L634)).
Without it, done-column siblings fall through to layout order plus
`created`-desc leftovers. Open a done task and press `j`: you navigate in a
different order than the column you are looking at. One-argument fix, but it is
a genuine second implementation of the ordering rule and belongs in the
centralization work.

### B5 (S3, latent) — An unstable selector is a #185 generator

zustand v5 reads through a **plain `useSyncExternalStore` with no equality
function** (`zustand/esm/react.mjs:5-13`). A selector that builds a fresh value
per call never compares equal, so React re-renders forever — the same #185.

[TaskCard.tsx:71-73](packages/board/src/ui/TaskCard.tsx#L71-L73) had
`state.config?.priority.values ?? []`. The inline `[]` is a new reference every
call whenever `config` is null. Latent today only because cards never render
before config loads — one `if (!config)` guard away from a hard crash.

**Fixed** — see §4.

### B6 (S3) — Search made the crash easier to hit

`getVisibleTasks` was called inline in the render body
([KanbanBoard.tsx:46](packages/board/src/ui/KanbanBoard.tsx#L46)). With a
non-empty query it returns a fresh array every render, invalidating
`baseColumns` → `columns` → every `SortableContext` `items` array. dnd-kit then
re-measures droppables on every render, which is precisely the input to the §1
loop.

**Fixed** — see §4.

---

## 3. Risky seams (no confirmed bug yet)

- **`refresh()` is a sledgehammer.** It replaces `tasks` and `config`
  wholesale on visibility change, on every file-watcher event, and on a 60 s
  poll. Any in-flight optimistic state is collateral. B2 is one symptom; a
  refresh landing *mid-drag* would also mutate `baseColumns` under dnd-kit's
  feet, changing `SortableContext` items and forcing a re-measure while the
  pointer is down. Untested and untestable today.
- **Ordering logic exists in three places.** Core's `reorderLayout`
  (authoritative, [tasks.ts:759](packages/core/src/tasks.ts#L759)), the store's
  `computeOptimisticLayout` (a deliberate mirror,
  [boardStore.ts:665](packages/board/src/store/boardStore.ts#L665)), and
  `getOrderedTasksForColumn` (render order). The mirror is documented as such
  and currently agrees, but nothing enforces it — B4 is what drift looks like.
- **`archiveTask`/`unarchiveTask` reimplement placement inline.**
  [boardStore.ts:508-535](packages/board/src/store/boardStore.ts#L508-L535)
  splices into `layout` by hand rather than going through the shared helper.
- **No end-to-end coverage of the drag path whatsoever.** `Board.test.tsx` (1409
  lines) never simulates a drag; `reorderTask` appears once, as a mock stub.
  Only the two pure helpers `resolveTaskDrop` and `getDragPreviewPosition` are
  tested. Every bug in this document lives in the untested gap between them.

---

## 4. What was landed inline

Authorized by the task for low-risk isolated fixes. Board tests 85/85, full
workspace typecheck clean.

**1. Damped the drag-preview feedback loop** —
[KanbanBoard.tsx](packages/board/src/ui/KanbanBoard.tsx). A genuine change of
user intent requires the pointer to move; dnd-kit's `event.delta` is already
scroll-adjusted, so scrolling counts as movement. A repeat `onDragOver` at the
*exact* delta we last acted on is by definition our own reflow talking, so it is
ignored. This cuts every face of the loop — null-over, cross-column, and the
placeholder case the existing guard covers — after a single extra cycle, well
under React's limit of 50.

Trade-off: if the layout settles under a held pointer into a genuinely better
target, we ignore it until the next pointer movement. `onDragEnd` recomputes
from the real `over` regardless, so a drop is never wrong — only the
intermediate highlight can lag. Strictly better than crashing.

**2. Stable selector fallback** —
[TaskCard.tsx](packages/board/src/ui/TaskCard.tsx). Hoisted the `[]` to a module
constant, with a comment naming the zustand-v5 hazard so the next selector
doesn't reintroduce it.

**3. Memoized `visibleTasks`** —
[KanbanBoard.tsx](packages/board/src/ui/KanbanBoard.tsx). Removes the
per-render array churn that was forcing dnd-kit re-measurement while searching.

Deliberately **not** landed: B2, B3, B4. B2 and B3 need store-wide request
sequencing — too broad for an inline spike fix. B4 is a one-argument change but
belongs with the ordering consolidation so the fork is closed rather than
papered over.

---

## 5. Recommendation

### Rebuild the preview layer (the real fix for #185)

The damping is a guard rail, not a cure. The cure is to make the drag preview
**stop changing the collision surface**. Two viable shapes:

**Option A — non-reflexive preview (preferred).** Never project the dragged card
into the destination column. Render the drop target as a fixed-height insertion
indicator between cards, sized to the card being dragged and *excluded from
dnd-kit's droppable set*. Column heights stay constant for the whole drag, so
`overId` becomes a pure function of pointer position. The loop cannot form,
because the output no longer feeds the input. Costs the make-room animation;
gains a preview that is correct by construction.

**Option B — decouple via a reducer.** Keep the projection, but drive it from a
single pure `dragPreviewReducer(state, intent)` that is idempotent under
re-entry: re-dispatching the same intent produces a referentially identical
state, so React bails out and the cycle terminates on its own. Preserves the
animation, but the loop still forms — it just self-terminates. More subtle,
easier to regress.

**Recommend A.** The animation is not worth a crash class that has already
shipped once.

### Centralize the move/reorder path

Independently of the preview, ordering should have exactly one implementation.
Proposed shape:

```ts
// One pure function. Owns layout order + status + done-sort together.
type MoveIntent =
  | { kind: 'reorder'; slug: string; toStatus: string; position: number }
  | { kind: 'status'; slug: string; toStatus: string }   // detail panel
  | { kind: 'remove'; slug: string }                     // delete / archive
  | { kind: 'restore'; task: Task; at?: { status: string; position: number } };

function applyMove(
  state: { tasks: Task[]; layout: BoardLayout },
  intent: MoveIntent,
  config: ShipbenchConfig,
): { tasks: Task[]; layout: BoardLayout };
```

Every handler dispatches an intent; nothing mutates `tasks`/`layout` directly.
`getOrderedTasksForColumn` becomes the single render-order function and always
receives `done_column` (closing B4 structurally). `computeOptimisticLayout`
becomes `applyMove` under a different name, and core's `reorderLayout` is
tested against it so the mirror can't drift silently.

### Add request sequencing (closes B2 and B3)

- Per-slug in-flight generation counter. A `refresh()` result may not overwrite
  a slug with a newer pending mutation.
- Scope `rollback` to the affected slug instead of restoring the whole board.
- Consider having the CLI's watcher suppress the event its own API write caused,
  so a move stops self-triggering a refresh. Cheaper than sequencing, but
  sequencing is still needed for genuine external edits.

### Test the drag path

The repo has no browser test runner — vitest + jsdom only. This constrains what
is worth writing, because **jsdom has no layout engine**: `getBoundingClientRect()`
returns zeros, dnd-kit's rect-based collision detection never fires, and the
§1 loop therefore cannot be reproduced there at all. Three tiers:

| Tier | Where | Cost | Covers |
| --- | --- | --- | --- |
| 1. Ordering math | `src/ui/KanbanBoard.test.ts` (exists), `moveReducer.test.ts` (new, with the reducer) | free | position/layout arithmetic, done-column sort |
| 2. Concurrency | `src/store/boardStore.test.ts` (exists, 961 lines) | cheap | B2, B3 — pure promise interleaving, no DOM needed |
| 3. Real drag | nothing today; would need `@vitest/browser` + playwright provider | high, ongoing | the §1 loop as a live symptom |

**Do tiers 1 and 2; skip tier 3.** The audit's probes drop straight into tier 2
as-is. For the crash, prefer making it unreachable by construction (Option A)
and asserting the *invariant* — rendered column contents are independent of
preview state — over simulating the *symptom*. If browser coverage is ever
wanted, `@vitest/browser` is the cheaper door than standalone Playwright, since
it keeps the existing vitest config and test style.

### Suggested ticket split

1. **`rebuild-board-drag-preview-as-non-reflexive-indicator`** (S1, Option A)
2. **`centralize-board-move-reorder-into-a-single-reducer`** (S2/S3, includes B4)
3. **`add-request-sequencing-to-the-board-store`** (S1/S2, B2 + B3)
