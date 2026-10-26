---
title: Ask before leaving a task with unsaved edits in the board
status: done
priority: medium
tags:
  - board
  - ui
depends_on:
  - stop-hidden-boards-from-handling-window-keyboard-shortcuts
created: '2026-09-23T19:37:22.651Z'
updated: '2026-09-27T19:48:20.149Z'
---

The board's detail view holds three kinds of unsaved text, and every way out
of the task drops them without a word:

- the **description editor** in `TaskBodySection`, which saves only when you
  press "Done";
- the **Task Updates composer** (`Task update text`);
- an **update being edited** (`Task update N text`).

(The title input saves on blur, so it doesn't lose anything this way.)

## How drafts get lost today

- **Leaving the task.** "Back to board", the "Tasks" breadcrumb, a task link
  in rendered Markdown (the Updates timeline renders them while the composer
  is open), opening the archive, and Escape with focus outside a text field.
  All of them discard any draft. Escape *inside* a text field is covered
  separately by
  [stop-hidden-boards-from-handling-window-keyboard-shortcuts](stop-hidden-boards-from-handling-window-keyboard-shortcuts.md).
- **Switching tasks misfiles an update.** `TaskBodySection` and
  `TaskUpdatesSection` in [DetailView.tsx](../../packages/board/src/ui/DetailView.tsx)
  aren't keyed by slug, so their state survives Previous/Next. Reproduced in a
  throwaway test: type an update on task A, click "Next task in column", and
  the text is still in the composer; submit it and `addComment` receives
  task B's slug. From reading the code, the description editor does the
  opposite: edit mode stays open, and the draft is replaced by task B's body.
- **Reloading or closing the tab.** Nothing warns you.

## Direction

- **Key the per-task sections by slug** (`key={task.slug}`), so no draft ever
  survives a task switch. This fixes the misfile whatever else lands, and it's
  the first thing to do.
- **Track dirty drafts in the store.** Each editor reports while its text
  differs from what it opened with, and clears the report on save, cancel, or
  unmount.
- **Guard navigation in one place.** Every in-app exit goes through the
  store's `selectTask`, `openArchive`, or `closeArchive` (the breadcrumb
  calls two of them). When a draft is dirty, those open a confirmation instead
  of navigating: a Radix dialog like `ArchiveTaskDialog`, titled along the
  lines of "Discard unsaved changes?". The body names what's unsaved (the
  description, a task update). Actions: "Keep editing", which has default
  focus and is what Escape does, and "Discard", which is destructive. Per
  [design-doctrine.md](../../docs/design-doctrine.md), use solid danger only
  for that final confirm. Confirming completes the navigation that was asked
  for.
- **Register `beforeunload` only while a draft is dirty.** Browsers show their
  own generic text there and ignore custom messages, so the in-app dialog is
  the only place for ShipBench's own wording. Registering only while dirty also
  keeps an embedding page's unload behavior untouched otherwise.
- **Leave read-only hosts alone.** They render no editors, so the guard never
  engages there. No change to `createBoard`'s options or to `BoardAPI`.

This depends on the Escape task: without that fix, every Escape pressed while
typing would open this dialog. The dirty-draft tracking is also what
[keep-board-drafts-intact-when-the-task-changes-on-disk](keep-board-drafts-intact-when-the-task-changes-on-disk.md)
needs, so whichever lands second should reuse it.

## Acceptance

- With an unsaved description, composer text, or update edit, each exit (back
  button, breadcrumb, Previous/Next, `j`/`k`, Markdown task link, archive,
  Escape outside a text field) opens the confirmation. "Keep editing" leaves
  everything as it was. "Discard" completes that exact navigation.
- With no unsaved text, every exit navigates immediately, exactly as today.
- Text typed into task A's composer is never submitted against task B.
- A reload or tab close while a draft is dirty triggers the browser's leave
  prompt. With no dirty draft it doesn't.
- The existing detail-view and navigation tests in
  [Board.test.tsx](../../packages/board/src/ui/Board.test.tsx) pass.
- Add a changeset, since this changes `@shipbench/board`.

## Task Updates

### 2026-09-27T19:47:19.114Z
Keying the per-task sections by slug had already landed with keep-board-drafts-intact-when-the-task-changes-on-disk, so the update misfile was fixed before this started. This task adds the dirty-draft tracking, the navigation guard, and the leave prompt.

`closeArchive` is left unguarded. The archive view and the detail view never render together, so no draft can exist when it runs. While the dialog is open, further navigation requests (such as `j` pressed behind it) are ignored rather than replacing the one being asked about.

One existing test changed: "does not carry a description draft to the next task" types a description and then clicks Next, which now opens the dialog. It clicks "Discard" before its original assertions, which still hold.
