---
title: Make task descriptions discoverable through board search
status: done
priority: high
tags:
  - board
  - search
  - ux
depends_on:
  - make-cli-search-retrieve-recorded-decisions-with-useful-context
created: '2026-09-05T21:33:38.341Z'
updated: '2026-09-27T18:44:36.122Z'
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

## Task Updates

### 2026-09-06T19:41:24.702Z
Board review made the search-semantics coordination an explicit dependency: this task now depends_on make-cli-search-retrieve-recorded-decisions-with-useful-context. Both tickets asked to decide the shared search contract with only prose cross-references between them, so whichever ran first would have set the contract implicitly and the other would have inherited or contradicted it.

The CLI ticket is the one that defines the contract — description and Updates coverage, matching semantics, ordering, and result context — so it goes first and this task implements the settled semantics in the board. Read the "need not wait for every CLI enhancement" line in the description under that decision: it still governs scope, not sequence. This task stays the bounded board-side correction and does not absorb CLI scope; it now waits for the contract rather than re-deciding it.

The edge was added by hand-editing frontmatter because task edit cannot yet set depends_on. See complete-validated-task-metadata-editing-in-the-cli.

### 2026-09-07T19:32:52.397Z
The shared search contract this task waited on is now settled. make-cli-search-retrieve-recorded-decisions-with-useful-context shipped the corpus and result-context half of it and is in review; the contract itself lives in docs/spec.md under the CLI section's "Search" heading, with the CLI-facing detail in the cli-reference "shipbench task search" section.

What this task implements against:
- Corpus: title, tags, description, and every Task Updates entry (plus a quarantined unreadable section, reported as an `updates` match).
- Result context: each match carries slug, title, current status, location (live/archive, supplied by the caller), matched_fields (now includes `updates`), a body snippet, and `update_matches` (readable entry -> index + timestamp + excerpt; unreadable -> `{ unreadable: true, snippet }`).
- History honesty: surface status and the Update timestamp; never label a match "current".

Deferred to their own tasks, so this board work does not inherit them: relevance ranking + omitted-match signalling, metadata/availability filters, whole-word and exact-phrase matching, semantic retrieval. The "need not wait for every CLI enhancement" line still governs scope — implement the corpus + result-context contract and stop.

Reuse: `searchTasks` in packages/core/src/search.ts is the contract in code. `TaskSearchMatch` / `TaskUpdateMatch` are exported from @shipbench/core.

### 2026-09-25T03:21:47.583Z
When this lands, update the last item under Limits in apps/site/src/content/docs/decision-trail.md. It currently says the local board's search matches task titles only.

### 2026-09-27T18:43:56.359Z
Implemented against the settled contract. Decisions made along the way:

- **One function, both surfaces.** The Board calls core's `searchTasks` through a new pure `@shipbench/core/search` subpath (same shape as `/layout`; biome now blocks importing it from the barrel). AGENTS.md's "one runtime exception" paragraph now names both subpaths.
- **Slug and assignee stay searchable.** They are added to the corpus as extra tags before `searchTasks` runs, so per-term semantics hold across them: `claude oauth` finds a task assigned to claude that mentions OAuth. The CLI corpus is unchanged.
- **No relevance reordering on the board.** Search hides cards; columns keep layout order and the done column keeps its time sort. Ranking would overwrite the one thing a column's position means. The spec's Ordering bullet said the Board would inherit ranking; it now says it deliberately doesn't.
- **Match context only when the card can't explain the hit.** If every term is already visible on the card face (title, slug, assignee, tags), nothing is added. Otherwise a "Found in" block shows the description snippet, or the first matching Update's excerpt with its timestamp, plus "Also in N Task Updates". No "current" labels.
- **Archive boundary unchanged.** Live search still never reads the archive. The empty state now lists the corpus; the archive view's filter (which already had the archive loaded) uses the same search, so the "Search archive" hand-off finds description matches too.
- No whole-word toggle on the board; quoted phrases work because the grammar is in core.

Verified in Chromium against this repo's own board via `board web`: `concise` finds the two live tasks that carry it only in their descriptions, each with a description snippet; `"shared search contract"` finds two tasks via Updates with timestamps. decision-trail.md's Limits item is updated per the previous Update.
