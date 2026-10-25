---
title: Decide whether the CLI finds the nearest board above the current directory
status: done
priority: medium
tags:
  - cli
  - dx
  - decision
created: '2026-09-26T19:44:04.679Z'
updated: '2026-10-25T23:03:45.266Z'
---

The CLI looks for `.shipbench/` only in the current directory, or in the `-C`
target, and never walks up. Run from `src/` inside a project, every `task`
command fails with a raw `ENOENT` naming a config path that was never supposed to
exist. This affects single-board repositories. Nested boards make it more
visible, because the natural place to run the CLI is inside the package.

This is a decision, not a build. It changes behavior for every user.

Source: [the multiple-boards spike](../../docs/audits/multiple-boards-in-one-repository-spike.md#4-discovery-the-cli-only-looks-in-the-current-directory).

## The candidate

Find the nearest ancestor that has `.shipbench/config.json`, stopping at the Git
worktree top level (or the filesystem root outside Git). With nested boards, this
routes an agent to the right board based on where it is working.

## Questions to settle

- Should writes report which board they resolved to? Otherwise a write from a
  directory with no board of its own lands on an ancestor board silently.
- `init` must not walk up. Should it mention an ancestor board? Today, running
  `init` in a subdirectory by mistake creates a second board without any warning.
- Should `-C` start the walk, or name the board exactly? Exact is safer for
  agents that already use `-C` to reach the canonical checkout.
- How does this interact with worktrees, where each worktree is its own top level?

Whatever is decided, replace the raw `ENOENT` with the message `board` already
prints: `No .shipbench/config.json found. Run shipbench init first.`

## Task Updates

### 2026-10-25T00:21:24.473Z
Decision, pending the owner's review: **yes, walk up.** Every command except `init` resolves the nearest board at or above where it runs. Probed first against the 0.4.x CLI: from `src/` in a fresh repository, `task list` exits 1 with `ENOENT ... src\.shipbench\config.json`.

**What it changes.** Only invocations that fail today. A directory with its own board still resolves to that board, `-C` keeps its meaning, and `init` is unchanged. Nothing that works now does something different afterwards, so this is an additive minor rather than a break.

**The walk.** Start at the shell's working directory. At each directory:

1. If `.shipbench/` exists, stop there. With `config.json`, that is the board. Without it, fail with the not-found message naming that directory. A nested board whose config was deleted must not quietly hand its writes to the parent board.
2. Otherwise, if a `.git` entry exists (directory or file), stop and report no board.
3. Otherwise, go to the parent. At the filesystem root, report no board.

The boundary is the `.git` entry, not `git rev-parse --show-toplevel`. It is the same top level, because a linked worktree and a submodule both carry a `.git` file at their root. Checking for it needs no subprocess on every command, and it works the same when Git isn't installed. Outside any repository the walk runs to the filesystem root, the way `git` itself searches.

**Questions from the task.**

- **Writes report the board they resolved to, but only when it was found above the starting directory.** One stderr line, so stdout and `--json` stay unchanged. Reads stay quiet: printing on every `task list` from a subdirectory teaches people to ignore the line, and a read doesn't change anything. The board server's `Serving .shipbench/ from <dir>` line already answers this for `board`.
- **`init` never walks.** When an ancestor board exists inside the same boundary, it creates the board anyway and prints a stderr note naming the existing one. Nested boards are sanctioned, so it warns rather than refuses. A mistaken second board then isn't silent any more.
- **`-C` names the board exactly. It never starts a walk.** It is how an agent addresses a specific board: the canonical checkout from a worktree (`-C ../main`), or a nested board from the root routing note (`-C packages/api`). An explicit address that misses should fail loudly, not resolve to whatever board sits above it. The help text, "Run as if ShipBench was started in the specified directory", would read as walk-from-here once walking is the default, so it changes to say the directory must hold the board.
- **Worktrees.** Each worktree is its own top level with its own `.git` file, so the walk never leaves it. That also covers worktrees created inside the main checkout (`.worktrees/<name>`, which the probe used): a command run there can't reach the canonical board and break the rule against changing status from a worktree. Reaching the canonical board stays an explicit `-C`.

**Other commands.** `board` and `board terminal` walk, and the watcher roots on the resolved board. `connect` walks too, then runs the check from `refuse-to-connect-a-board-below-the-repository-root-to-harbor` against the resolved board root. From `src/` in a single-board repository, that resolves to the root board and passes, which is the right answer.

**Not found.** The raw `ENOENT` becomes the message `board` already prints, `No .shipbench/config.json found. Run shipbench init first.`, plus the directory it searched from. Use the same exit code as `board`.

**Rejected:** walking only for reads (a write from `src/` would still fail, which is most of the complaint); a walk from `-C` (see above); stopping at a `.shipbench/` only when it has `config.json`, as the candidate stated it (that skips a broken nested board in favour of its parent).

The build is filed as `find-the-nearest-board-above-the-current-directory`. It depends on this task, so it becomes available once the decision is marked done.

### 2026-10-25T23:03:34.504Z
approved by owner
