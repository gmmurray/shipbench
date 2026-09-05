# Malformed Updates section: recovery spike

**Date:** 2026-09-04
**Task:** `spike-get-a-malformed-updates-section-back-into-cli-acceptable-form`
**Scope:** every path that reads, writes, or displays a task whose trailing
`## Task Updates` section does not parse — `parseTaskBody`, `serializeTask`,
`updateTask`, the three `task comment` mutations, `task get` / `list` / `search`,
the Board's description and Updates panels, and what Harbor inherits from all of
it.
**Method:** read of `packages/core/src/tasks.ts`, `packages/core/src/types.ts`,
`packages/board/src/ui/DetailView.tsx`, `packages/board/src/store/boardStore.ts`;
behavior probed against the built 0.4.0 CLI in a throwaway board holding a task
whose second entry heading is `####`.

---

## Verdict

**Do not build a repair command. Fix the representation instead.**

The spike was framed as "how do we get a malformed task back into
CLI-acceptable form." The probing says that is the cheap part. For a convention
whose premise is plain Markdown in Git, the repair is a ten-second text edit —
change one `#` — and the person running the CLI already has the file open. What
makes it expensive today is that nothing tells them which line is wrong, two of
the three surfaces never mention the problem at all, and one command destroys
the section while reporting success.

One decision in the parser produces all of that. When the Updates section does
not parse, core returns the **entire raw body** as `Task.body`, discarding a
split it has already computed. `Task.body` documents itself as "Timeless task
description, excluding the reserved trailing Task Updates section." On a
malformed task it is the opposite, and every consumer that trusts that comment
inherits the damage.

Three things are worth building. A repair command is not one of them.

---

## 1. What "malformed" means, and what can still reach it

`parseTaskBody` has seven failure branches:

| #   | Detail reported                                   | Reachable through the CLI in 0.4.0?             |
| --- | ------------------------------------------------- | ----------------------------------------------- |
| 1   | more than one `## Task Updates` heading           | No — both write guards reject a marker          |
| 2   | date-shaped heading at a level other than 3       | No — the comment guard rejects it               |
| 3   | a `###` date-shaped heading that is not ISO 8601  | No — same guard                                 |
| 4   | an entry with no text                             | No — blank text is refused                      |
| 5   | text before the first entry heading               | No — `serializeTask` cannot emit it             |
| 6   | an unclosed code fence                            | No — both guards reject it                      |
| 7   | the section contains no entries                   | No — the section is omitted when empty          |

After the 0.4.0 write guards, **no CLI command can create a malformed section.**
The remaining population is files written by a hand edit, a merge conflict, a
ShipBench at 0.3.x or earlier, or another tool. This repository currently has
none, live or archived.

That matters for sizing. A repair tool would run only after a human edited a
file by hand, in a repository where that human has the file open.

## 2. Behavior today, verified

Against a task whose good first entry is followed by a `####` second heading:

| Command                                            | Behavior                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| `task list`                                        | Works. Prints the `updates` warning                                  |
| `task search`                                      | Works. Matches the broken section as `body` and shows it in a snippet |
| `task get`                                         | Works. **Prints no warning at all**                                  |
| `task move`                                        | Works. Bumps `updated`, preserves the raw section                    |
| `task comment` / `comment edit` / `comment delete` | Refuse, naming the malformed section                                 |
| `task edit --body`                                 | **Succeeds and deletes the entire Updates section**                  |
| Board — description panel                          | Shows the raw section as the description; saving is rejected         |
| Board — Updates panel                              | Reads "Task Updates 0". No indication anything is wrong              |

## 3. `Task.body` breaks the contract it documents

```ts
/** Timeless task description, excluding the reserved trailing Task Updates section. */
body: string;
```

`malformedUpdates` returns `body: body.trim()` — the whole document, marker and
entries included — with `comments: []`. The parser found the marker's line index
before it began parsing entries, so the split is known and then thrown away.

Everything in section 2 that looks like a separate bug is this one decision seen
from a different surface:

- **`task edit --body` destroys the section** because the raw text lives in
  `body`, and `updateTask` replaces `body` and serializes `comments: []` over the
  top. The good entries go with the bad one.
  `assertBodyWithoutUpdatesMarker` does not catch it, because the _new_ body is
  clean. Git is the only trail.
- **The Board shows the section as the description** because it renders
  `task.body`.
- **`task search` matches it as description text** for the same reason.
- **The Board cannot save** a task whose description it just filled from
  `task.body`, because that text contains the marker.

## 4. The Board is a dead end that points the wrong way

The Board's description editor is prefilled from `task.body`, so for a malformed
task the textarea already holds the full broken section — the one place in the
system where the raw text is both visible and editable. Pressing Done rejects the
save:

```
Invalid task description: remove the "## Task Updates" heading — that section is
written by `task comment`. Put the heading in a code fence if the description
means it literally.
```

Verified: this happens whether the text is saved unchanged **or correctly
repaired**. Someone who fixes the `####` to `###` in that textarea is told to
delete the section they just fixed, and the advice names `task comment`, which
refuses this task.

The repair path is therefore already most of the way built, and fails on one
condition: the guard does not know the task on disk is currently malformed.

## 5. The corruption is invisible where anyone would look

`getTask` returns a `Task` and never runs `validateTask` — validation lives in
`listTasksInDirectory`, because `depends_on` warnings need the full slug set. The
`updates` warning needs neither config nor slugs, but it rides the same path, so
the narrowest read — the one `.shipbench/AGENTS.md` tells agents to prefer — is
silent.

In the Board, `state.warnings` is populated but `DetailView` renders only
`depends_on` warnings. An `updates` warning is loaded and never displayed. The
same holds in Harbor, which is read-only and inherits the Board's rendering.

So the CLI mentions it on `list` and `search`, says nothing on `get`, and the two
graphical surfaces say nothing anywhere.

## 6. Answers to the spike's questions

**Is a repair command worth building?** No. Every route into this state now
requires hand-editing a file, and whoever hand-edited it has the file open. What
they lack is a diagnosis precise enough to act on, and any indication that
something is wrong.

**Repair, or only diagnose?** Diagnose. The warning names the rule that was
broken but not the line that broke it. Quoting the offending line — `expected
each entry heading to use "### <ISO 8601 timestamp>" (saw "#### 2026-07-25T09:30:00.000Z")` —
is a one-line change and turns the repair into a search-and-fix.

**What repairs are safe without asking?** Moot once the answer above is "do not
repair." Recorded for later: promoting a date-shaped `####` heading to `###` is
nearly unambiguous; inventing a timestamp for an entry that lacks one is not, and
the second is not something a CLI should do at any confirmation level.

**Should the escape hatch be additive?** The quarantine in §7 is the additive
answer. Nothing is discarded, and the broken text stops contaminating the
description.

**Where would it live — `task comment --force`, `task doctor`, `task get --raw`?**
None of them. Once the section is quarantined into its own field, `task get
--json` already returns everything, which is `--raw` without the flag.

**Should the read path become best-effort?** No. Returning the entries that
happened to parse would let a mangled file look fine, which is the exact failure
this parser's strictness exists to prevent, and it would let `task comment`
mutations rewrite a section the parser only partly understood. Quarantine the
section; do not half-read it.

**What does Harbor do, and must repair work read-only?** Harbor renders the Board
against a GitHub adapter and makes no writes, so it shows the same silent, wrong
description as the local Board and could not repair anything if it wanted to.
Repair does not need to work read-only. _Visibility_ does.

## 7. Recommendation

Three changes, in value order. None of them is a repair command.

**A. Quarantine the unreadable section instead of folding it into the
description.** `parseTaskBody` already knows the marker's line index. Return the
text above it as `body`, and carry the section below it verbatim on a new
optional `Task` field. `serializeTask` writes that field back unchanged when it
is present. The field is additive to the published type, and it closes,
structurally:

- the `task edit --body` data loss — the section is no longer in `body` to be
  overwritten, so it survives without a new guard;
- the Board's rejected save — the textarea holds a real description again;
- `task search` matching broken entries as description text.

`task comment` should keep refusing a task in this state. Appending to a section
that cannot be read would leave it just as unreadable.

**B. Make it visible.** Surface the `updates` warning from `getTask`, and render
it in the Board's Updates panel beside the quarantined text. Two surfaces, one
warning that already exists and is already computed.

**C. Sharpen the diagnosis.** Quote the offending line in the warning detail.

**Deliberately not doing:** a repair or doctor command, a `--force` on
`task comment`, and any best-effort parse. Revisit only if someone actually
reaches this state after A–C ship. With a diagnosis that names the line and a
Board that shows the raw text, the file edit should be shorter than the command
would have been to type.
