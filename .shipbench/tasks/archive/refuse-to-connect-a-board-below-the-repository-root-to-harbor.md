---
title: Refuse to connect a board below the repository root to Harbor
status: todo
priority: medium
tags:
  - cli
  - harbor
  - bug
created: '2026-09-26T19:44:04.506Z'
updated: '2026-09-26T19:44:04.506Z'
---

Harbor reads the board at the repository root. Running `shipbench connect --harbor`
or `shipbench init --harbor` from a nested board still connects the repository,
so Harbor then shows the wrong board, or setup instructions for a board that
does not exist.

The pre-flight check makes this worse. `git cat-file -e HEAD:.shipbench/config.json`
resolves from the repository root, not from the project directory, so a
committed nested board gets a false "absent from HEAD" warning. A repository
with a root board passes the check for the wrong board.

Found by [the multiple-boards spike](../../docs/audits/multiple-boards-in-one-repository-spike.md#3-the-connect-defect).

## Acceptance

- `connect --harbor` refuses, before contacting Harbor, when the project
  directory (the shell directory, or the `-C` target) is not the Git worktree
  top level. Exit 2, like the other pre-flight refusals.
- `init --harbor` refuses the same way before it writes any file.
- The message says Harbor reads the board at the repository root and names the
  directory that was used.
- Plain `init` and every other command keep working in a subdirectory.
- Tests cover a nested-only repository and a repository with both root and
  nested boards, for both commands.

Correcting the path spec alone is not the fix. It would remove the false warning
but still connect the wrong board.
