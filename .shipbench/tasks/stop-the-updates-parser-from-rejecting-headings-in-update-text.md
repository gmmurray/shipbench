---
title: Stop the Updates parser from rejecting headings in update text
status: done
priority: high
tags:
  - core
  - cli
created: '2026-09-02T23:20:07.844Z'
updated: '2026-09-02T23:36:03.119Z'
---

An agent using ShipBench 0.3.0 in another repo reported that the Updates parser
rejects a task after `task comment` has already written it. Any line starting at
column 0 with an ATX heading marker and a space — `#` through `######` — inside
an update's text makes the next read return a malformed Updates section.

The write succeeds and the read fails later, so nothing surfaces the problem
until someone touches that task's Updates again. Worse, the recovery path is
closed: once a task parses as malformed, `task comment`, `comment edit`, and
`comment delete` all refuse it, while `task get`, `list`, `move`, and
`edit --body` keep working. The board looks healthy and the file can only be
repaired by hand.

The trigger is the wrong-level-heading guard in `parseTaskBody`. It treats every
column-0 heading inside entry text as a botched entry heading, so a `####` in
ordinary prose is indistinguishable from a hand-written entry heading at the
wrong level. The parser is already fence-aware and correctly ignores indented
headings and `#hashtag`, so the fix is narrow.

## Scope

- Only a heading whose text is shaped like a date is an entry heading. Prose
  headings at any level are entry text.
- Validate update text on write so the CLI cannot produce a file it will later
  refuse to read: reject text carrying its own `## Task Updates` marker, a
  column-0 heading that reads as an entry heading, or an unclosed code fence.
- The same silent-corruption path exists for descriptions: a description with an
  unclosed code fence swallows the `## Task Updates` marker on the next read and
  the entries disappear from every consumer. Reject that on write too.
- `task comment` is the only body-taking command with no `--body-file`, and it
  is the one most likely to receive long multi-line prose. Give it, and
  `task comment edit`, the same `--body` / `--body-file` pair that
  `task create` and `task edit` have.

## Task Updates

### 2026-09-02T23:33:12.432Z
Shipped. The trigger was narrower than the guard: `parseTaskBody` treated every
column-0 heading in entry text as a botched entry heading. Only a heading whose
text starts with a calendar date is judged that way now, so a wrong-level
hand-written entry heading is still caught and everything else is prose.

Three write-time guards came with it, so the CLI can no longer write a file it
will later refuse to read — the asymmetry that made this bug survivable long
enough to strand a task. The description path had the same shape: an unclosed
code fence swallowed the `## Task Updates` marker and hid every entry from
`task get`, the board, and search while the file still held them.

#### Aside worth keeping

`--body-file` on `task comment edit` did not work until the program enabled
positional options. An option declared on a parent command claims every later
occurrence of its flag, so commander handed the path to `task comment` and left
the subcommand empty. The same setting means `-C <path>` must now precede the
subcommand, which is the only place `resolveProjectDirectory` ever read it.

This update is itself the regression test: it has an `####` heading in it.
