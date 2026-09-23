---
title: Keep the board's window shortcuts out of hidden boards and text fields
status: todo
priority: medium
tags:
  - board
  - ui
created: '2026-09-23T19:18:26.591Z'
updated: '2026-09-23T19:29:03.629Z'
---

Two board components listen for `keydown` on `window`:

- [BoardCanvas.tsx](../../packages/board/src/ui/BoardCanvas.tsx) handles
  Escape: it closes the archive view, or deselects the task.
- [DetailView.tsx](../../packages/board/src/ui/DetailView.tsx) handles
  `j`/`k`/ArrowUp/ArrowDown: it steps through the column and calls
  `preventDefault`.

A host that mounts several boards and hides the inactive ones, for example as
tabs using `display: none`, gets every keystroke delivered to every board.
Escape on the visible board also closes the detail views in the hidden ones.
A hidden board with a task open handles the arrow keys and calls
`preventDefault`, which blocks page scrolling. It can also disable the visible
board's own `j`/`k`: DetailView's handler returns early on
`event.defaultPrevented`, and `window` listeners run in registration order.
Whichever board mounted first wins.

Filed from a review of how an outside host would embed `@shipbench/board`. The
claims were re-checked against source before filing.

## Also in scope: Escape while typing leaves the task

This one happens with a single board. BoardCanvas's Escape handler checks
neither `event.defaultPrevented` nor where focus is. DetailView's `j`/`k`
handler already skips `isEditableTarget(event.target)`. Reproduced in a
throwaway test:

- Escape in the description editor closes the detail view. The draft is never
  saved (`updateTask` isn't called), because the editor only saves on "Done".
- Escape in the Task Updates composer closes the detail view too, and the
  half-written update goes with it.

Escape inside a Radix dialog (e.g. the archive confirmation) is fine. It
closes the dialog and the detail view stays open.

The fix belongs in the same shared hook. Along with the "is this board
rendered" check, skip events whose target is editable, and events that are
already `defaultPrevented`, for every handler that goes through it, Escape
included. Escape inside a text field then does whatever the field does (the tag
and dependency comboboxes use it to close their suggestion lists) and never
navigates.

## Why the keyboard is the issue

Per-instance state is already handled. Stores are per instance through
`BoardStoreProvider`. `BoardHeader` sets `--sb-header-h` on its own board root
(`header.parentElement`). A hidden board's `BoardToaster` renders inside the
hidden tree. The `window` listeners are the only place one board acts on the
others.

Toasts are not fully per instance either. `boardStore` calls sonner's
module-level `toast()`, and every `<Toaster>` renders every toast. A toast
raised by a hidden board appears in the visible board's toaster. That is
harmless while hidden boards can't take actions, and this task removes the
main way they can (keystrokes). Treat it as out of scope, but if you notice
another path, file it separately.

## Not the fix: moving the listeners to the board root

Key events only reach an element that has focus. The standalone board would
stop answering Escape and `j`/`k` whenever focus sits on `<body>`, which is
the state right after load. Listening on `window` is correct for a single
board.

## Direction

Keep listening on `window`, but have each handler return early when its own
board isn't rendered. Put this in one shared hook (e.g.
`useBoardKeydown(handler)`) that gets the board's root element from context,
rather than duplicating the check in both components. Nothing exposes the root
through context today. `BoardHeader` reaches its root through
`parentElement`. So `BoardShell` in [Board.tsx](../../packages/board/src/ui/Board.tsx)
needs to provide a ref to its `.sb-board-root` element. Check "rendered" at
keydown time, not at mount, because the host toggles visibility without
remounting. No change to `createBoard`'s options or return type.

**Watch out: jsdom has no layout.** `getClientRects()` and `offsetParent`
return nothing for every element under jsdom. A layout-based check
(`root.getClientRects().length === 0`) would make every board look hidden in
tests and break the existing keyboard tests. Either define "hidden" in terms
jsdom can see (the root or an ancestor has the `hidden` attribute or a
computed `display: none`), or keep the layout check and stub it in tests.
Choose deliberately and record the reasoning in a comment on the hook.

## Acceptance

- With two boards mounted and one hidden, Escape and `j`/`k`/arrows affect
  only the visible board, and the hidden board never calls `preventDefault`.
  Cover the mount-order case: the hidden board mounted first must not block
  the visible board's `j`/`k`.
- Escape pressed in the description editor, the Updates composer, or an
  update being edited leaves the detail view open and the draft intact. Escape
  with focus outside a text field still closes the detail view or the archive
  view.
- Otherwise, single-board behavior (standalone and embedded) is unchanged. The existing
  keyboard tests in [Board.test.tsx](../../packages/board/src/ui/Board.test.tsx)
  (Escape closes detail, `j`/`k` navigation) pass unmodified.
- Add a changeset. Outside hosts only get this fix through an `@shipbench/board`
  release, and the fixed group releases core, board, and the CLI together.
