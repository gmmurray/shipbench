---
title: add clear button to the search tasks bar on board
status: done
priority: low
created: '2026-09-26T20:56:45.819Z'
updated: '2026-09-27T18:55:43.333Z'
---

The board's "Search tasks" input can only be emptied by selecting the text and deleting it. Add a clear control so a filtered board is one action away from the full board.

## Behavior

- A clear button appears inside the right edge of the search input, only while the input has text. An empty input shows no button.
- Activating it empties the input and returns focus to the input, so the user can type a new query straight away.
- Clearing takes effect immediately. The board does not wait out the 200 ms debounce, because the user has asked for the unfiltered view and a delay would look like a lag. The no-match state ("No live tasks match ...") and the done-column cap both return to normal at once.
- Pressing Escape while the input is focused and non-empty clears it too. Escape in an empty input does nothing new, and it must not compete with the existing Escape handling that closes detail mode: a non-empty search consumes the keypress first.
- The button is a real button, reachable by keyboard, with an accessible name such as "Clear search". The input currently has no accessible name beyond its placeholder; give it one while here, since the clear button sits next to it.
- Read-only hosts (Harbor) get the same control. Search is a view filter, not a write, so `readOnly` does not affect it.

## Design

- Follow [docs/design-doctrine.md](docs/design-doctrine.md) for the icon and hit target. The magnifying glass sits at the left, so the input's right padding grows to make room and text never runs under the button.
- The button uses the same muted silver as the search icon at rest, brightens on hover and focus, and shows the standard focus ring.
- No layout shift when the button appears or disappears: reserve the padding always, or overlay the button without changing the input's width.

## Out of scope

- No search history, saved queries, or new filters.
- No change to what a query matches (title, slug, tags, assignee) or to the debounce for typed input.
- No clear control in the archive view. The header hides the search input there.

## Acceptance

- With text in the input, one click or Escape empties it, restores every task, and leaves focus in the input.
- The button is absent when the input is empty and reachable by Tab when it is present.
- Existing search behavior (debounce, no-match state, done-column cap) is unchanged for typed input.
- Board tests cover the button's appearance, click-to-clear with focus, immediate clearing without the debounce, and Escape.

## Open questions

- Should a native `type="search"` input's built-in clear be used instead? Recommendation: no. Its appearance varies by browser and cannot follow the design doctrine.
- The debounce effect lives in the header's local `draftSearch` state. An immediate clear has to update the store's `searchQuery` directly as well as the draft; implementation should settle how, without a second source of truth.

## Task Updates

### 2026-09-27T18:54:56.145Z
Implemented in BoardHeader. Open question settled: clearing sets both the header's draft and the store's searchQuery; the draft stays the only source, and the pending debounce re-applies the same empty string harmlessly. Escape calls stopPropagation on the input so BoardCanvas's window listener does not also close detail mode. The search wrapper changed from <label> to <div> because a button inside a label is invalid HTML; the input takes aria-label="Search tasks" instead. The native type=search clear was not used. Added a minor changeset for @shipbench/board and shipbench.
