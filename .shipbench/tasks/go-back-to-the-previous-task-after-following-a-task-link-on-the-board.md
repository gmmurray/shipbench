---
title: Go back to the previous task after following a task link on the board
status: done
priority: medium
tags:
  - board
  - dx
created: '2026-11-20T22:57:20.226Z'
updated: '2026-11-23T23:32:15.165Z'
---

## Goal

After following a link from one task to another in the detail view, you can go back to the task you came from, not only to the board. In the board `shipbench board` serves, the browser's back button does the same thing.

## Why

Task bodies link to each other all the time: a spike to its follow-ups, a task to the sibling that shares its surface. Following a link opens the target in place through `selectTask`, and the only way out is "Back to board". Every hop loses the trail, so reading a chain of tasks means reopening each one from the board.

## Shape

**The Board never touches browser history itself.** "URL routing inside Board" stays a non-goal ([design.md](../../docs/board/design.md#non-goals-for-now)). An app that embeds the Board may own the URL and use history for its own routes, and nothing at runtime tells the Board whether it does. `window.top === window` holds for any single-page app, not only the CLI's page. So the decision goes by entry point: `standalone.tsx` is the page the CLI serves, where the board is the whole page. `index.tsx` is the library entry other apps embed. Fonts and `applyStoredBoardTheme` already split the same way.

1. **A trail in the store.** All in-app navigation already goes through `navigate()` in `boardStore.ts`, behind the unsaved-edits guard. Keep a stack of slugs there.
   - Following a task link from a description or Task Update pushes the current task.
   - Opening a card from the board starts a new trail.
   - j/k moves within a column and doesn't push, so back doesn't retrace j presses.
   - Linking to a task already in the trail cuts the trail back to it instead of pushing it again, so A → B → A doesn't grow.
   - A task in the trail that has since been archived or deleted (the board is live) is skipped, so back never lands on "Task no longer exists."
   - "Back to board", ESC, and the breadcrumb go to the board and clear the trail.
2. **A back button.** When the trail isn't empty, add "Back to *\<previous task's title\>*" beside "Back to board". The title says where it goes.
3. **A host navigation hook.** `createBoard` takes something like `initialTaskSlug`, `onSelectedTaskChange(slug, { push })`, and a way to select a task from outside. The library default ignores all three, so an embedding app's history is untouched unless it wires them to its own router. This makes design.md's "a host can lift `selectedTaskSlug` to its own URL" a real API.
4. **Standalone wiring.** `standalone.tsx` connects the hook to `history`.
   - Opening a card or following a link pushes an entry. j/k uses `replaceState`.
   - `popstate` selects the slug in the entry it lands on.
   - The task goes in the URL (`?task=<slug>` or `#task=<slug>`; pick one), so a reload or a shared local link reopens it. That's fine here because the page belongs to the board.
   - The in-app back button calls `history.back()` when this hook is wired, and uses the stack from (1) otherwise. Either way there's one trail, and the in-app back can't disagree with the browser's.

## Edge cases to test

- **Unsaved edits on browser back.** The URL has already changed when `popstate` fires. If the guard asks and the user picks "Keep editing", the standalone wiring must push the current task's entry back, or the URL and the screen drift apart.
- **A deep link to an unknown slug.** If `?task=<slug>` names a missing or archived task on load, show the board and drop the parameter (with `replaceState`) instead of showing "Task no longer exists".
- **The archive view.** `navigate()` also opens the archive view. Decide whether that gets a history entry.

## Done when

- Following task links builds a trail, and the in-app back walks it, both embedded (stack) and standalone (history).
- In `shipbench board`, browser back and forward move between tasks and the board, and a reload keeps the open task.
- A library host that doesn't pass the hook sees no change to `window.history` or the URL. A test checks this.
- [design.md](../../docs/board/design.md) explains the split: in "Detail mode", the trail and the hook; in the non-goals, that the Board doesn't route but its hosts may.
- A changeset for `@shipbench/board` and `shipbench`, minor, since this adds a capability and new `createBoard` options.

## Task Updates

### 2026-11-23T23:27:23.427Z
Implemented as shaped. Decisions the task left open, and one deviation:

- **URL form: `?task=<slug>`.** The board server routes on `url.pathname`, so a query needs no server change, and it leaves the hash to in-page anchors.
- **The archive view gets no history entry.** Opening it from a task is reported as going to the board (push), so browser back from the archive returns to the task. Forward from there lands on the board, not the archive.
- **Related list counts as a link.** Opening a task from the meta pane's Related list pushes the trail, the same as a link in a description or Task Update. It's the same act: following a reference from one task to another.
- **The hook's shape** (`BoardNavigation` on `createBoard` / `<Board>` as `navigation`): `initialTaskSlug` + `initialTrail`, `onSelectedTaskChange(slug, { push, trail })`, `subscribe(select)` for host-initiated selection, and `back(steps)`. Two additions beyond the sketch, both needed for "one trail": the change carries the `trail`, and the standalone stores it in each entry's `history.state`. That way browser back/forward and reload restore the in-app back too. `back` takes a step count, so skipping an archived task in the trail goes back the same number of history entries.
- **Deep link to an unknown slug** falls back to the board and is reported with `push: false`. The standalone turns that into `replaceState`, which drops the parameter. The same applies when `popstate` lands on a task that has since gone.
- The dev demo (`packages/board/demo/main.tsx`) also gets the history wiring, the same way it already passes `documentTitle`, so dev exercises what ships.

Verified: `pnpm typecheck`, `pnpm lint`, `pnpm test` (1149 pass, including 13 new in `BoardNavigation.test.tsx`, one of which asserts a host without `navigation` sees no `history` call and an unchanged URL). Also drove the real `shipbench board` in Chromium with Playwright: deep link, follow link, reload keeping the trail, browser back/forward, in-app back via `history.go`, back to board, and an unknown `?task=` dropping to `/`.

Known gap: clicking an in-page `#anchor` link in a task body adds a browser history entry the board didn't write. A later in-app back then goes one entry short, because the history step count no longer matches the trail. Task bodies rarely use in-page anchors and the board renders no heading ids, so I left it.
