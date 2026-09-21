---
title: 'Spike: let the owner''s agents report ShipBench issues from other projects'
status: backlog
priority: medium
tags:
  - spike
  - agents
  - dx
  - product
created: '2026-09-20T18:06:00.660Z'
updated: '2026-09-20T18:06:00.660Z'
---

## Question

Should the owner's own agents, working in unrelated projects, be able to report
ShipBench defects directly onto this board — and if so, what is the smallest
form that works?

## Context

An agent working in this repo reported a real defect: a duplicate YAML key made
two tasks vanish from the board
([surface-a-task-whose-frontmatter-cannot-be-parsed-instead-of-dropping-it.md](surface-a-task-whose-frontmatter-cannot-be-parsed-instead-of-dropping-it.md)).
It reached the maintainer only because the owner is the maintainer. The same
observation made in any other project would have died in a transcript.

Agents hit tool edges humans do not — they hand-edit files, parse JSON strictly,
and use every flag — and they hold the reproduction for about as long as the
session lasts. That combination is the value. It is also why the report was
partly wrong: it asserted the CLI gave no warning, when the warning was on
stderr the whole time.

This spike covers the owner's own machine only. The discussion that produced it
rejected a general feedback feature, and those rejections are inputs, not
questions to reopen.

## What the discussion rejected, and why

- **A local capture queue for third-party developers** (`shipbench feedback`
  writing to `~/.shipbench/`, reviewed and submitted later). A queue implies
  someone owns it, reviews it, and decides when to ship it. That is maintainer
  work, and nobody signed up for it by adopting a task convention.
- **Harbor as an inbox.** It would be the first stored credential the CLI ever
  holds — `connect` uses a one-shot pasted token today — couples the offline
  product to the hosted one, and casts the solo dev's workbench as our support
  desk.
- **An anonymous submit endpoint.** A tool whose argument is that you need no
  service should not make unattended network calls, and an unauthenticated write
  endpoint is a spam target.

One public-side idea survived and is **not** part of this spike: a single line
in the scaffolded README/AGENTS.md pointing at the GitHub new-issue URL. If it
is ever written, it must say *show the user this link*, never *file an issue* —
an agent with `gh` authenticated can otherwise file unattended, which is the
unverified-lead flood with the human gate removed.

## Why the personal version may be nearly free

- The CLI roots at the shell cwd, so `cd` into this repo plus `task create` is
  already the whole transport. No `--project` flag exists, and one may not be
  needed.
- `backlog` already means information gathering that a human promotes. An
  unverified cross-project lead is exactly that, and the review gate is already
  the promotion mechanism.
- Agents do not commit here, so the uncommitted task file appearing in
  `git status` is itself the notification.

If that holds, the only missing piece is an agent in an unrelated repo knowing
any of it — which is a skill's job, not a feature's.

## Possible lines of inquiry

- Is a skill the right carrier, or would owner-level memory or a global
  CLAUDE.md entry do the same with less machinery?
- Direct `task create` against this repo, or a drop file promoted later?
  `task create` also writes `layout.json`, a shared file — establish whether an
  out-of-band write actually causes trouble when work or a worktree is in flight
  here, or whether the concern is theoretical.
- What a report must contain. A cross-project agent cannot read this source, so
  every report is a lead: require the command, the raw output, the version, and
  the platform, and say plainly that diagnosis is not its job. The origin report
  above is the test case — its conclusion was wrong while its raw stderr would
  have been right.
- Blast-radius rules for an agent writing into a repo it was not invited into:
  one backlog task, tagged, no moves, no other tasks, no commits.
- Where the artifact lives. [AGENTS.md](../../AGENTS.md) settles that agent
  tooling in this repository is reference files users copy; this one's audience
  is the owner alone. Decide whether it lives here and is installed globally, or
  does not belong in the repository at all.
- Does this generalize? "Create a task on another ShipBench board from this
  project" is the same primitive
  [spike-explore-a-local-workbench-across-shipbench-repositories.md](spike-explore-a-local-workbench-across-shipbench-repositories.md)
  circles. Decide whether to solve it narrowly here or wait for that spike.

## Expected outcome

A recommendation with its tradeoffs and remaining uncertainties. "Guidance
only," "reuse what exists," and "not worth building" are all valid conclusions.
If it is worth building, name the smallest next step and the decisions that
remain open.

This spike does not commit ShipBench to shipping a reporting feature, and
nothing in it applies to third-party users.

## References

- [Dogfood agent guidance](../AGENTS.md)
- [Product spec](../../docs/spec.md)
