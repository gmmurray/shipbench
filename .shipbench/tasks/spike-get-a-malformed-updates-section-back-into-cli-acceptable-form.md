---
title: 'Spike: get a malformed Updates section back into CLI-acceptable form'
status: done
priority: medium
tags:
  - core
  - cli
  - spike
created: '2026-09-02T23:38:01.115Z'
updated: '2026-09-05T01:26:56.593Z'
---

A task whose Updates section does not parse is readable but unfixable through
the CLI. Every `task comment` command refuses it — including the two that would
repair it — while `task get`, `list`, `move`, and `edit` keep working, so the
board looks healthy and the only way out is a hand edit. The parser fix that
shipped in 0.4.0 removed the most common way to *reach* that state; it did
nothing for a task already in it, or for one that arrives by hand edit, merge
conflict, an older ShipBench, or another tool writing the file.

This is a spike: decide whether repair belongs in the CLI at all, and if so what
shape it takes. It is not a commitment to build one.

## What is true today

Verified against 0.4.0 with a task whose second entry heading is `####`:

| Command | Behavior on a malformed task |
| --- | --- |
| `task get` / `task list` | Works. Returns the whole raw section as `body`, `comments: []`, plus an `updates` warning |
| `task move` | Works. Bumps `updated`, preserves the raw section |
| `task comment` (append) | Refuses |
| `task comment edit` / `delete` | Refuses |
| `task edit --body` | **Succeeds, and deletes the entire Updates section** |

That last row is the sharp edge and probably wants fixing regardless of what
this spike concludes. `updateTask` replaces `task.body` — which for a malformed
task holds the raw Updates text — and serializes `comments: []` over the top.
The good entries go with the bad one, the command reports success, and Git is
the only trail. `assertBodyWithoutUpdatesMarker` does not catch it, because the
*new* body is clean.

A read reports one sentence of detail and no location: `Malformed Updates
section: expected each entry heading to use "### <ISO 8601 timestamp>". Raw
Markdown was preserved in the task body.` Whether a repair tool needs more than
that is part of the question.

The parse branches that can produce a malformed section, from `parseTaskBody`:
more than one `## Task Updates` heading; text before the first entry heading; a
date-shaped heading at a level other than 3; a `###` heading whose text starts
with a date but is not ISO 8601; an entry with no text; an unclosed code fence.

## Questions to answer

- Is a repair command worth building, or is "open the file, fix the heading,
  commit" the honest answer for a convention whose whole premise is that tasks
  are plain Markdown in Git? A tool that only ever runs after a hand edit may
  not earn its surface area.
- If it is worth building: does it repair, or only diagnose? A diagnosis that
  names the file, the line, and what the parser expected may be most of the
  value, and it cannot destroy anything.
- What repairs are safe to make without asking? Promoting a `####` entry heading
  to `###` is nearly unambiguous. Inventing a timestamp for an entry that has
  none is not. Where is the line, and does anything below it belong in the CLI?
- Should the escape hatch be additive instead — a way to move unparseable text
  down into a fresh entry, or into the description, so nothing is discarded and
  the section parses again?
- Does this belong to `task comment` (a `--force` that rewrites the section from
  what did parse), a new `task doctor` / `task repair`, or `task get --raw` plus
  documentation?
- Does anything need to change in the read path? A best-effort parse that
  returned the entries it could read, with a warning, would make a malformed
  task mutable again without any new command — but it would also let a mangled
  file look fine, which is the failure mode the strict parse exists to prevent.
- What does Harbor do with one of these today, and does a repair story have to
  work read-only?

## Constraints worth carrying in

- Core is headless. Anything interactive lives in the CLI, and the repair
  primitive core exposes has to be callable without a terminal.
- Never discard prose the user wrote. Git is the recovery trail, not the plan.
- Whatever ships should also make the `task edit --body` data loss above
  impossible, since a repair path that leaves that in place is a half answer.

## Task Updates

### 2026-09-05T01:09:30.749Z
Spike done. Findings in
[docs/audits/malformed-updates-recovery-spike.md](../../docs/audits/malformed-updates-recovery-spike.md).

Verdict: do not build a repair command. After the 0.4.0 write guards no CLI
command can create a malformed section, so the remaining population is files a
human or another tool wrote — and that human has the file open. The repair is a
ten-second text edit. What is actually broken is everything around it, and all
of it traces to one decision: on a parse failure the parser returns the entire
raw body as `Task.body`, discarding a split it has already computed.

Two things the probing turned up that were not in the task as written:

`task edit --body` on a malformed task deletes the whole Updates section and
reports success. Verified, not inferred. That was written into the spike as a
hazard; it is now the reason recommendation A is priority high.

The Board is a dead end that points the wrong way. Its description editor is
prefilled from `task.body`, so the textarea already holds the broken section —
the only place in the system where the raw text is visible and editable — and
saving is rejected whether the text is unchanged or correctly repaired. The
error tells you to delete the section you just fixed and names `task comment`,
which refuses the task.

Two follow-ups in `todo`:
`quarantine-an-unreadable-updates-section-instead-of-folding-it-into-the-description`
and `show-an-unreadable-updates-section-in-the-board`, the second depending on
the first. Both are scoped against the audit, and both carry the same explicit
non-goals: no repair command, no `--force`, no best-effort parse.
