---
title: 'Spike: run multiple ShipBench boards in one repository'
status: done
priority: medium
tags:
  - spike
  - product
  - cli
  - convention
created: '2026-09-26T19:39:32.229Z'
updated: '2026-09-26T19:59:09.368Z'
---

One repository sometimes holds more than one body of work that wants its own
board: a monorepo whose packages ship on separate schedules, a product repo that
also holds its docs site, or a writing project with a manuscript and a separate
publishing track. ShipBench assumes one `.shipbench/` per project, rooted at the
directory the CLI runs in. This spike asks whether several boards in one
repository already work, where they break, and whether anything should be built.

This is a spike: find out what is true and recommend. It is not a commitment to
build multi-board support.

## Questions to answer

- **What works today with zero code?** A `.shipbench/` in a subdirectory, reached
  with `cd` or `-C`. Which commands, clients, and conventions behave correctly,
  and which assume the board sits at the repository root?
- **Where does it break?** Check the CLI (every command, `board` and
  `board terminal`, `connect`), the Board UI running two at once, the file
  watcher, `init`, Harbor's GitHub reads, and agent discovery of each board's
  `AGENTS.md`.
- **What are the candidate shapes?** Nested `.shipbench/` directories, several
  boards inside one `.shipbench/`, or one board partitioned by tag or column.
  Compare what each costs the convention, core, and every client.
- **What must not change?** Each `.shipbench/` stays self-contained, and core
  stays rooted at one project through its adapter.
- **Cross-board relationships.** Can a task depend on or refer to a task on a
  sibling board? If not, is that a gap or the right boundary?

## Constraints worth carrying in

- The [local workbench spike](spike-explore-a-local-workbench-across-shipbench-repositories.md)
  already covers views across repositories. Keep this one to boards inside a
  single repository and name where the two meet.
- Say only what the product does today. A recommendation that nested boards work
  must be verified against the built CLI, not inferred from the code.

## Deliverables

- Findings in `docs/audits/`, with the verified behaviour of each surface.
- A recommendation: document what already works, build something small, or defer.
- Follow-up tasks for anything worth doing, left for the owner to promote.

## Task Updates

### 2026-09-26T19:44:19.401Z
Spike done. Findings are in
[docs/audits/multiple-boards-in-one-repository-spike.md](../../docs/audits/multiple-boards-in-one-repository-spike.md).

Verdict: nested `.shipbench/` directories are the shape, and they already work
in every local client with no code changes. A board is defined by the directory
its adapter is rooted at, so core never needed to know about the Git root. I
verified `init`, every `task` command, `-C`, and two browser boards at once
(port fallback, isolated watchers) against the rebuilt CLI. Several boards
inside one `.shipbench/` is rejected: it rewrites the convention's one fixed path
and fixes only Harbor discovery.

One real defect came out of it. `connect --harbor` from a nested board checks
the root's config path, because a `HEAD:path` spec resolves from the repository
root, and then connects the repository anyway. Harbor shows the wrong board, or
none.

Follow-ups: `refuse-to-connect-a-board-below-the-repository-root-to-harbor` and
`document-running-several-shipbench-boards-in-one-repository` in `todo`, and
`decide-whether-the-cli-finds-the-nearest-board-above-the-current-directory` in
`backlog`, because nearest-board discovery changes behavior for every user.
Harbor reading nested boards is left to the Harbor-role spike.
