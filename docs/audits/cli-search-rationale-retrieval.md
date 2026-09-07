# CLI search rationale-retrieval evaluation

**Date:** 2026-09-07
**Task:** `make-cli-search-retrieve-recorded-decisions-with-useful-context`
**Scope:** whether adding Task Updates to the `task search` corpus measurably
improves an agent's ability to answer "why did we do this?" questions, and
whether any measured miss justifies a later semantic-retrieval investigation.
**Method:** a capable agent with filesystem tools answered three rationale
questions about this repo's own board under three conditions — (A) `Read` /
`Grep` / `Glob` only, (B) the pre-change CLI (`task search` blind to Updates),
(C) the post-change CLI. Ground truth for each question was established first
with full filesystem access. Conditions B and C simulate an agent that reaches
for `task search` before grepping.

## Questions

1. Why does `make-task-descriptions-discoverable-through-board-search` depend on
   `make-cli-search-retrieve-recorded-decisions-with-useful-context`? Who
   decided, and when?
2. Why is a worktree task's claim (its move to `in-progress`) committed *before*
   `git worktree add`, not after?
3. Why can't `shipbench task edit` just repair a malformed Task Updates section —
   why was `Task.unreadableUpdates` introduced instead?

Q1 and Q2 have their rationale recorded **only** in a Task Updates entry. Q3's
rationale is layered: the conclusion and load-bearing reasons are in task bodies
and Updates, but the fullest argument is in `docs/audits/malformed-updates-
recovery-spike.md` — a non-task file no version of `task search` indexes.

## Where each rationale actually lives (ground truth)

| Q | Authoritative source | Form |
| --- | --- | --- |
| 1 | `make-task-descriptions-discoverable-through-board-search.md`, Update `2026-09-06T19:41:24.702Z` (mirror entry in the CLI task, same wall-clock) | Task Update only |
| 2 | `make-the-documented-worktree-handoff-preserve-task-state-through-merge.md`, Update `2026-09-06T20:01:47.732Z`; restated in `concurrent-agents.md` and `recipe-worktree-rules.md` | Task Update (+ shipped docs) |
| 3 | `quarantine-an-unreadable-updates-section-…md` body + Update `2026-09-05T01:37:41.665Z`; `spike-get-a-malformed-updates-section-…md` Update `2026-09-05T01:09:30.749Z`; **`docs/audits/malformed-updates-recovery-spike.md` §6–§7** (full argument); `.changeset/quarantine-unreadable-updates.md` | Task bodies + Updates + audit doc + changeset |

Note on Q1's "who/when": git history does not sharpen it — the dependency edge
and its Update landed together inside the bundled commit `4616068`. The Update
timestamp is the authoritative record, so the CLI conditions are not at a
disadvantage on attribution.

## Retrieval outcome

| | Q1 | Q2 | Q3 |
| --- | --- | --- | --- |
| **A — filesystem** | Full | Full | Full (reaches the audit doc) |
| **B — old CLI** | Recovered, but only because the follow-up `task get <slug>` dumps every Update — `task search` itself matched nothing in the Update; reasonable paraphrases ("board search dependency") returned junk | Recovered via `task get`; narrow queries ("worktree claim commit order") returned 0 matches | Conclusion + key reasons from task files; full argument only by following the link the task body prints |
| **C — new CLI** | Answer visible **in the search result**: `↳ update 0 (2026-09-06T19:41:24.702Z): Board review made the search-semantics coordination an explicit dependency…`, plus the mirror hit, with index + timestamp for precise retrieval | Answer in the search result: `↳ update 0 (2026-09-06T20:01:47.732Z): …The claim is committed before \`git worktree add\`, so the branch inherits it…` | Same task-level hits as B, reached faster — the spike's Update excerpt now names the audit-doc path in the result |

## Evidence retrieval, misses, and output volume

- **Evidence retrieval.** The new CLI surfaced all three rationales directly in a
  single `task search` result, each with the matching entry's index and
  timestamp. The old CLI is structurally blind to Updates: every phrase that
  lives only in an Update (`"Board review made the search-semantics"`,
  `"stale todo"`, `"moves the failure rather than removing it"`) returns **0
  matches**. It rescued all three answers here only because the agent's natural
  next step — `task get <slug>` — returns the whole `comments[]` array regardless
  of CLI version. When the slug is not already known, the old CLI is also
  markedly more sensitive to query phrasing.
- **Missed relevant records.** The new CLI missed nothing that lives in a task.
  Its one blind spot is shared with the whole `task search` design: non-task
  Markdown — `docs/**`, `.changeset/**`, `docs/spec.md` — is never in the corpus.
  Only Q3's deepest layer is affected, and the two relevant task files name and
  link the audit doc explicitly, leaving an agent exactly one known hop from the
  full argument. Filesystem-only missed nothing, at 2–4× the reading volume
  (Q3 ≈ 400+ lines across four files).
- **Output volume.** New CLI is the lightest for Q1 and Q2: one search, ~12–18
  lines, answer inline with a precise `(index, timestamp)` pointer — no need to
  pull a multi-thousand-word task body. The old CLI costs an extra `task get` per
  question and forces reading the entire task body plus every Update (the
  worktree task alone is ~180 lines) to reach one paragraph.

## Does any miss justify semantic retrieval?

Not yet. Every rationale in this sample was recoverable lexically under the new
CLI. The one measured gap — Q3's fullest argument sitting in an audit doc and a
changeset — is an argument for **widening the lexical corpus to `docs/` and
`.changeset/`**, not for embeddings. The more interesting signal is phrasing
sensitivity: the old CLI whiffed on reasonable paraphrases, and the new CLI still
depends on the searcher reusing vocabulary that appears in the Update. That is
worth watching, but the CLI-search contract set the bar at "measured misses
justify a later investigation", and this evaluation produced none.

## Recommendations

1. **Ship** the Task Updates corpus change — it is a clear, measured improvement
   with no regression.
2. **Consider a follow-up** to extend the lexical corpus to `docs/**` and
   `.changeset/**` (or at least audit docs), which would have closed the only gap
   found here. Not filed as a task yet — raise it if the pattern recurs.
3. **Do not** open a semantic-retrieval investigation on the strength of this
   evaluation. Revisit only if paraphrase misses show up repeatedly in practice.
