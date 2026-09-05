---
title: Let a task's description be written and revised without hand-editing the file
status: done
priority: high
tags:
  - cli
  - core
  - dx
created: '2026-09-02T16:36:55.187Z'
updated: '2026-09-05T01:26:55.178Z'
---

A task cannot come into existence with its description attached. `task create`
sets every frontmatter field — title, status, priority, tags, `depends_on` — and
owns slug generation, collision suffixes, timestamps, and the layout index. It
cannot set the body. So writing a description is always a second, manual step
against the file the CLI just wrote, and there is no CLI path to *revise* a
description at all.

This is reported from outside: an agent maintaining a different project's board
through the published CLI. That makes it a report about the shipped contract, not
about this repo's dogfooding conventions.

## What the second step costs

**It makes an agent re-emit machine-owned frontmatter.** Writing the body means
writing the whole file, so `created` (which the contract says never changes),
`updated`, `tags`, and `depends_on` all get hand-transcribed back. The reporter
did this eleven times in one session. Every one of those is a chance to silently
corrupt a task the tool had just written correctly.

**It puts one invariant on both sides of the line.** `create`, `move`, and
`comment` all maintain `updated`. Editing a description does not — which is why
`.shipbench/AGENTS.md` has to carry "Always update the `updated` timestamp" as a
rule an agent is expected to remember. The tool enforces it in three places and
delegates it in the fourth.

**It leaves a window where a task exists with no content.** Between the create
and the write, the board holds a titled task with an empty body. A session that
ends there — context limit, error, user stopping the agent — leaves that empty
task as what survives. It looks fine in `task list` and is only visibly wrong on
`task get`.

**On Windows the manual step is actively lossy.** A PowerShell 5.1
`Get-Content`/`Set-Content` round-trip decodes UTF-8 as Windows-1252 and
re-encodes it, corrupting every non-ASCII character and adding a BOM. The
reporter lost five task files that way in one session, and the repair is itself
lossy. Whatever else this is worth, keeping agents out of task files by hand is
worth more than it looks.

## Why the workaround isn't one

`task comment` does take prose as an argument, so a description could be pushed
through it. But that files the description in Updates, and the contract is
explicit that an Update is for something whose meaning depends on when it
happened. A description is not that. The correct home is the one the CLI doesn't
reach.

## What already exists

Core is most of the way there. [`updateTask`](../../packages/core/src/tasks.ts)
already takes an optional `body` and rewrites it while preserving `created`,
bumping `updated`, and leaving the Updates section alone.
[`createTask`](../../packages/core/src/tasks.ts) hardcodes `body: ''` and takes
no body option. The [CLI's `task create`](../../apps/cli/src/cli.ts) exposes
neither, and there is no `task edit` at all.

## The decisions this task has to make

The outcome is fixed — a task can be created with its description, and a
description can be revised, without an agent opening the file. How is open. Each
decision below carries a proposed answer and the reason it wins; they are
recommendations, not settled design.

**1. How prose gets in.** *Proposed:* `--body-file <path>` as the documented
default for agents, with `-` meaning stdin, plus `--body <text>` for one-liners.
Mutually exclusive; error on conflict rather than defining a precedence order.

The deciding factor is Windows. Both alternatives route the bytes through the
shell: a quoted multi-line argument hits PowerShell quoting rules, and a
`Get-Content notes.md | shipbench …` pipe hits the same Windows-1252 decode that
cost the reporter five files. Piping is not an escape from the encoding bug, it
is another instance of it. `--body-file` has Node open the file itself with an
explicit `utf8` read, so the content never touches the shell. Stdin is still
worth supporting for Unix and CI; `--body` keeps parity with `task comment` for
a one-sentence description.

**2. Whether create and edit are one decision or two.** *Proposed:* one — ship
both.

Editing is the higher-frequency operation and carries most of the corruption
risk, because it is the one that forces a read-modify-write of an existing file.
Shipping `create` alone closes the smaller half and leaves `.shipbench/AGENTS.md`
and the `init` template still instructing agents to hand-edit task files for
revisions, so the docs line in the definition of done could not be met either.
The follow-up would be nearly the same surface, tests, and changeset.

**3. What "edit" means for a body that already exists.** *Proposed:*
`task edit <slug>`, replace-whole-body, no append.

Replace is the honest primitive and is what `updateTask` already does. No
`--append`: an append-shaped body write is what makes people reach for
`task comment` semantics in the wrong place, and a caller who wants append can
`task get --json`, modify, and write back. Name it `edit` rather than `update` —
"update" is already the vocabulary of the Updates section and of the `updated`
field. Body-only flags to start, but the name leaves room for `--title` and
`--tags` later; `--status` stays with `task move`, which owns layout. Decide
deliberately that an empty `--body ""` or empty file **clears** the description
rather than no-opping — that is the empty-body case in the definition of done.

**4. Whether the Updates section is protected.** *Proposed:* reject a body
containing the marker, and reject it in core rather than in the CLI.

`serializeTask` writes `task.body` verbatim, and the next `parseTaskBody` splits
at `## Task Updates` — so a body carrying that heading either silently turns part
of the description into comments or produces a malformed-updates warning.
Neither is recoverable by the user. Core should refuse it with an error naming
`task comment` as the right path.

In core, not the CLI, because the hazard exists today without any new flag:
`BoardAPI.updateTask` takes a body ([standalone.tsx](../../packages/board/src/standalone.tsx)),
so the Board's detail-panel editor can already type that heading into a
description. Validating in `createTask`/`updateTask` closes the existing hole and
covers Harbor at the same time. Confirm what the Board does with it today —
that is a bug to file either way while this task is open.

## Scope

- `@shipbench/core` if `createTask` needs a body option.
- `shipbench` CLI: the create path, and whatever the edit answer turns out to be.
- Docs that describe the gap or the workaround it forces: the CLI reference on
  the site, `.shipbench/AGENTS.md`'s "Direct File Operations" section, and the
  `AGENTS.md` template `shipbench init` scaffolds — the "always update `updated`"
  rule exists because of this hole and should shrink when it closes.
- A changeset. This is a published-surface change on both packages.

## Definition of done

- An agent can create a task with a multi-line Markdown description in one
  command, on Windows, without quoting gymnastics.
- An agent can replace an existing task's description in one command.
- Neither path touches `created`; both bump `updated`; neither disturbs
  `## Task Updates`.
- A body containing the Updates marker is rejected with an error naming
  `task comment`, and an empty body clears the description.
- Tests cover a body containing the Updates marker, a body with non-ASCII
  characters, and an empty body.
- The docs no longer instruct anyone to hand-write a task file for this.

## Task Updates

### 2026-09-02T22:01:27.948Z
Shipped with all four proposed answers taken as written: --body-file (with '-' for stdin) plus --body, mutually exclusive; create and edit together; 'task edit' as a whole-body replace with no append, where an empty value clears the description; and the Updates-marker check in core rather than the CLI. Confirmed the Board hazard while implementing: its detail-panel editor reaches core's updateTask with an arbitrary body, so a description typed with that heading was corrupted on the next read. The core check closes that path too — boardServer now answers 400 with the message instead of writing it, so no separate bug needed filing.

### 2026-09-02T22:06:15.677Z
Re-read the site docs against stop-the-project-files-spec-describing-core-instead-of-the-file-format after review feedback. Three additions: convention-spec.md now states the description/Updates boundary as a rule of the format (writes reject a description carrying the heading; fenced occurrences are exempt) rather than leaving it as CLI-only behavior, and concurrent-agents.md and recipe-worktree-rules.md name 'task edit' where they previously said 'refine its description' with no command — the pasteable block was implying a hand-edit that now has a command. Also retuned the cli-reference paragraphs so the flag, not the implementation, is the subject.
