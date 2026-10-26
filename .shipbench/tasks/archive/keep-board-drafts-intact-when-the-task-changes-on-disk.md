---
title: Keep board drafts intact when the task changes on disk
status: done
priority: medium
tags:
  - board
  - ui
created: '2026-09-23T19:37:22.773Z'
updated: '2026-09-27T19:34:33.599Z'
---

The CLI board refreshes whenever a task file changes on disk
(`onTasksChanged`, fed by the file watcher), and other hosts poll. Agents
editing tasks while the owner has the board open is the intended way to use
ShipBench, not an edge case. But the detail view's editors treat every refresh
as the truth and discard or misplace whatever the user was typing. Both cases
below were reproduced in throwaway tests against
[DetailView.tsx](../../packages/board/src/ui/DetailView.tsx):

- **An open description draft is replaced.** `TaskBodySection` runs
  `useEffect(() => setDraft(body), [body])`. The user is mid-edit, an agent
  changes the task's body, the refresh lands, and the textarea now holds the
  agent's text. The user's words are gone, with no notice.
- **An update edit saves over a different entry.** `TaskUpdatesSection`
  tracks the entry being edited by its index. With three updates, the user
  starts editing #2, and an agent deletes #1 (`task comment delete`). After
  the refresh, the edit form is still open, now at index 1, which holds the
  entry that used to be #3. Save sends `editComment(slug, 1, …)` and
  overwrites the agent's entry with the user's correction.

`TitleInput` has the same `setDraft(value)` reset. It only fires if the
*title* changes on disk while you're typing one, so it's rare, but it belongs
in the same fix.

## Direction

- **A dirty draft survives a refresh.** If the editor's text still matches
  what it opened with, take the new value silently, as today. If the user has
  changed it, keep their text and show an inline notice that the task changed
  on disk since they started, with a way to load the new version (discarding
  theirs) or carry on. Don't auto-merge.
- **Identify an update being edited by its timestamp, not its index.** Core
  preserves an entry's timestamp across edits, so it's the stable identity.
  Resolve the index from the latest entries when saving. If the entry is gone,
  keep the draft and say so instead of saving.
- **Share the "is this draft dirty" tracking** with
  [ask-before-leaving-a-task-with-unsaved-edits-in-the-board](ask-before-leaving-a-task-with-unsaved-edits-in-the-board.md).
  Whichever task lands second reuses it. Neither blocks the other.

## Out of scope, and worth a decision

This is the *incoming* direction: disk overwrites the draft. The *outgoing*
direction also exists. `updateTask` replaces the whole body, and
`editComment`/`deleteComment` address entries by index, so a board save can
overwrite an agent's change the board hasn't seen yet. On the CLI board, the
watcher's refresh usually arrives first, which this task handles. On a
polling host, the window is up to 60 seconds. Closing it properly means
optimistic concurrency, e.g. sending the task's `updated` value and having
core reject a stale write. That changes `BoardAPI` and core, and it reaches
every host. If it's wanted, file it as its own task rather than growing this
one.

## Acceptance

- With an unsaved description draft, a refresh that changes the body keeps
  the draft and shows the changed-on-disk notice. Loading the new version
  replaces the draft only when the user asks. With no unsaved changes, the new
  body shows up as it does today.
- Editing update #2 while #1 is deleted on disk either keeps editing the same
  entry (now #1) or keeps the draft and reports that the entry moved or is
  gone. It never saves over a different entry. Tests cover deleting an earlier
  entry and deleting the edited entry itself.
- An on-disk title change doesn't wipe a title being typed.
- Add a changeset, since this changes `@shipbench/board`.

## Task Updates

### 2026-09-27T19:32:56.642Z
Landed first, so the shared dirty-draft tracking lives here: `useDraft` in [useDraft.ts](../../packages/board/src/ui/useDraft.ts) exposes `dirty` per editor. [ask-before-leaving-a-task-with-unsaved-edits-in-the-board](ask-before-leaving-a-task-with-unsaved-edits-in-the-board.md) can report that to the store instead of adding its own tracking. The composer is still plain `useState`, since nothing on disk feeds it.

This also landed that task's first step. The title, description, and Updates editors are keyed by slug. Without the keys, keeping a dirty draft would have carried task A's description into task B on Previous/Next. Previously the draft was just replaced by B's body.

Decisions:

- Update identity is timestamp plus occurrence among entries sharing that timestamp. The occurrence only matters in hand-written files. The delete confirmation uses the same identity, because it had the same index bug.
- If the edited entry is deleted and the draft is dirty, the editor moves above the list with the warning, a Discard button, and no Save. If the draft is clean, the editor just closes.
- The title's notice buttons keep focus in the input on click. The input also skips its blur-save when focus moves into the notice, so neither choice saves the draft first.

Not done: the assignee `MetaInput` still resets its draft on every refresh. It saves on blur like the title, so it is small and rare. The outgoing-direction optimistic concurrency is still unfiled, as the description suggests.
