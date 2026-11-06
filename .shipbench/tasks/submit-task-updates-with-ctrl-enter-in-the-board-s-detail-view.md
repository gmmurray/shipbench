---
title: Submit Task Updates with Ctrl+Enter in the Board's detail view
status: backlog
priority: low
tags:
  - board
created: '2026-10-29T19:17:59.112Z'
updated: '2026-10-29T19:17:59.112Z'
---

Ctrl+Enter (Cmd+Enter on macOS) should submit the Task Update forms in the detail view. Right now, the only way to submit is to move the mouse or press Tab to reach the button.

The new-task dialog already does this. See `onKeyDown` in [NewTaskDialog.tsx](../../packages/board/src/ui/NewTaskDialog.tsx), which handles `ctrlKey || metaKey` plus `Enter` and calls `requestSubmit()`, and its tests in `Board.test.tsx` (the `['Ctrl', …], ['Cmd', …]` cases). Reuse that pattern so both surfaces behave the same.

## Scope

- **Add-a-task-update form** in `TaskUpdates` ([DetailView.tsx](../../packages/board/src/ui/DetailView.tsx)). This is the main ask.
- **Edit-update form** (`editForm`) in the same component. It would be odd for one Update textarea to support the shortcut and the other not.
- Plain Enter still inserts a newline. `requestSubmit()` goes through the existing `onSubmit`, so the empty-draft and in-flight guards keep working, and a double press can't post twice.

Out of scope: the description editor. It has no submit, only an Edit/Done toggle, and it already captures Tab. Whether Ctrl+Enter should mean "Done" there is a separate question.

## Acceptance

- Ctrl+Enter and Cmd+Enter submit both forms. Plain Enter doesn't.
- Nothing happens when the draft is empty or a save is in flight.
- Tests follow the existing Ctrl/Cmd cases.
- Optionally, the hint line under the composer mentions the shortcut.
- A changeset for `@shipbench/board`.
