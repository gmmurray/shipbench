---
title: Make task descriptions discoverable through board search
status: todo
priority: medium
tags:
  - board
  - search
  - ux
created: '2026-09-05T21:33:38.341Z'
updated: '2026-09-06T18:33:32.536Z'
---

A person returning to a project may remember a phrase from its reasoning rather than a task title. The September 5 evaluation created a task with "concise" only in its description. The CLI's task search found it with a body snippet; the browser board's "Search tasks" field reported no matching live tasks.

The current board filter searches title, slug, assignee, and tags, but excludes descriptions. Its empty state explains archive exclusion without explaining this exclusion. The data exists but the interface does not help recover it.

## Related rationale-retrieval work

The owner reports agents answering later "why did we do this?" questions by finding explanations in related tasks. This makes descriptions and Updates valuable search content for humans as well as agents.

Coordinate the selected shared search semantics with the separate CLI search ticket. The board's description-search correction remains a bounded deliverable; it need not wait for every CLI enhancement. Include a recorded-decision example when judging result context and the chosen handling of Updates.

## Decisions before implementation

Decide the intended search contract across the board and CLI: description text, Task Updates, matching semantics, and useful result context. Updates are a separate decision; do not assume the CLI currently searches them either. Preserve existing searches for slugs, assignees, and tags unless a deliberate decision says otherwise.

Choose how a user understands why a task matched when the term appears only in its content. Retain deliberate live/archive boundaries and the done-column search behavior; avoid silently expanding archive reads.

## Acceptance

- Searching for a phrase found only in a live task description finds that task in the board.
- The chosen treatment of Updates and the live/archive boundary is explicit in the experience and relevant documentation.
- Result presentation gives enough context to identify the right task.
- Existing metadata search and recovery from an empty result still work.
- Verify the original example in the actual browser and add focused coverage for the chosen search semantics.

Read [Board design](../../docs/board/design.md) before implementation. The current filter is getVisibleTasks in [boardStore.ts](../../packages/board/src/store/boardStore.ts); compare [CLI search](../../packages/core/src/search.ts).
