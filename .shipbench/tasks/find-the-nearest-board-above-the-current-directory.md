---
title: Find the nearest board above the current directory
status: done
priority: medium
tags:
  - cli
  - dx
depends_on:
  - decide-whether-the-cli-finds-the-nearest-board-above-the-current-directory
created: '2026-10-25T00:21:24.556Z'
updated: '2026-10-25T23:24:37.366Z'
---

Make the CLI resolve the nearest board at or above the directory it runs in, as decided in [the discovery decision](decide-whether-the-cli-finds-the-nearest-board-above-the-current-directory.md). That task's Update is the specification. The summary here is for selecting work.

## Behaviour

- Every command except `init` walks up from the shell's working directory. At each directory: a `.shipbench/` stops the walk (it is the board if it holds `config.json`, otherwise not found); a `.git` entry (directory or file) stops the walk with no board; otherwise go to the parent, ending at the filesystem root.
- `-C <path>` names the board directory exactly and never walks. Reword its help text to say so.
- `init` never walks. When an ancestor board exists inside the same `.git` boundary, it still creates the board and prints a stderr note naming the ancestor.
- Mutating commands print one stderr line naming the board root when it was found above the starting directory. Reads print nothing extra. stdout and `--json` are unchanged.
- `board`, `board terminal`, and the file watcher root on the resolved board. `connect` resolves the board the same way before its repository-root check.
- No board found: replace the raw `ENOENT` with `No .shipbench/config.json found. Run shipbench init first.`, naming the directory searched from, with the same exit code `board` uses today.

## Where

- `apps/cli/src/processCli.ts`: `resolveProjectDirectory` and `createProcessCli`. `defaultProjectName` stays the basename of the starting directory, since only `init` uses it and `init` doesn't walk.
- The CLI reference's `-C` entry and a line on discovery; `docs/spec.md`'s CLI section; the scaffolded `AGENTS.md` can say commands work from any subdirectory of a board.
- A changeset (minor).

## Tests

A subdirectory of a single board; a nested board shadowing the root board; a directory with `.shipbench/` but no `config.json` below a valid board (fails, doesn't fall through); a linked worktree inside the main checkout (stays in the worktree); `-C` at a board-less directory below a board (fails); `init` below a board (creates, warns); the write notice present on stderr and absent from `--json` stdout.

## Task Updates

### 2026-10-25T23:10:53.604Z
Built as decided. Two places the decision left open: (1) the write notice reads `Using .shipbench/ from <path>`, to match the board server's `Serving .shipbench/ from <dir>`; it prints from a Commander preAction hook before the write, so a rejected write still names the board. (2) `board` and `board terminal` now check for the board in `createCli` before starting, so both views print the same path-bearing message. `startBoardServer` and the terminal reader keep their own path-free message for direct callers. I left the scaffolded `AGENTS.md` alone: commands that already worked from the board root still do, and changing the template changes every project's file, so that's a separate call.
