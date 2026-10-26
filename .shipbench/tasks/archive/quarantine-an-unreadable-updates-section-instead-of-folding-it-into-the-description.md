---
title: >-
  Quarantine an unreadable Updates section instead of folding it into the
  description
status: done
priority: high
tags:
  - core
  - cli
created: '2026-09-05T01:09:14.290Z'
updated: '2026-09-05T01:41:29.143Z'
---

When a task's `## Task Updates` section does not parse, `malformedUpdates`
returns the entire raw body as `Task.body` with `comments: []`. `Task.body`
documents itself as "Timeless task description, excluding the reserved trailing
Task Updates section", so on a malformed task the field is the opposite of what
it advertises, and every consumer that trusts the comment inherits the damage.

The sharpest consequence is data loss. `task edit --body` on a malformed task
succeeds, reports `Updated description on <slug>`, and deletes the whole Updates
section — good entries included — because the raw text lived in `body` and
`updateTask` serializes `comments: []` over the top. `assertBodyWithoutUpdatesMarker`
does not catch it: the *new* body is clean. Git is the only trail.

The same decision is why the Board renders the broken section as the description
and then refuses to save it, and why `task search` matches broken entry text as
description text.

See [docs/audits/malformed-updates-recovery-spike.md](../../docs/audits/malformed-updates-recovery-spike.md)
for the full findings, the verified behavior matrix, and why a repair command is
deliberately not part of this.

## Scope

- Keep the split `parseTaskBody` already computes. The marker's line index is
  known before entry parsing begins; on a parse failure, return the text above
  it as `body` and carry the section below it verbatim on a new optional `Task`
  field (`unreadableUpdates?: string`, or a better name found in review).
- `serializeTask` writes that field back unchanged when it is present, so a
  frontmatter or description write preserves the broken section without needing
  a guard to defend it.
- `task comment`, `comment edit`, and `comment delete` keep refusing a task in
  this state. Appending to a section that cannot be read would leave it just as
  unreadable.
- Surface the `updates` warning from `getTask`. Today validation runs only in
  `listTasksInDirectory` because `depends_on` warnings need the full slug set;
  the `updates` warning needs neither config nor slugs, so the narrowest read —
  the one `.shipbench/AGENTS.md` tells agents to prefer — is silent about
  corruption.
- Quote the offending line in the warning detail, so the repair is a
  search-and-fix rather than a hunt.
- The new field is additive to a published type. Harbor reads `Task`, so the
  changelog entry should say plainly that `body` no longer carries the broken
  section.

## Not in scope

A repair command, a `--force` on `task comment`, and any best-effort parse that
returns the entries that happened to read. The spike rejected all three with
reasons; do not reintroduce them here.

## Task Updates

### 2026-09-05T01:37:41.665Z
Shipped. `parseTaskBody` keeps the split it already computed: `body` is the
description above the marker, and the section below it rides on
`Task.unreadableUpdates` as `{ text, reason }`, written back byte-identical by
`serializeTask`. The data loss closes structurally rather than by a guard — the
raw text is no longer in `body` for `updateTask` to overwrite.

Verified end to end against the case from the audit: `task edit --body` now
preserves the whole section, `task get` warns and names the offending line,
`task comment` still refuses, `task search` stops matching broken entry text as
description, and fixing the one `####` by hand restores parsed entries and
comment mutations.

Two things went beyond the scoped list, both small and both load-bearing:

The `updatesParseWarnings` WeakMap is gone. With the state on the task, the
mutation guards read `task.unreadableUpdates` directly, and the warning message
comes from the new exported `unreadableUpdatesWarning`. That also fixes the
reason `task get` was silent — the state used to live in a module-private map
that no single-task caller could reach.

The unclosed-fence reason now names the line that opened the fence, which meant
tracking it through the entry loop. The other five reasons quote the line that
broke them.

Not done here, by design: no repair command, no `--force`, no best-effort parse.
`show-an-unreadable-updates-section-in-the-board` is unblocked.
