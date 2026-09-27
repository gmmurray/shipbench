---
title: Decide whether the CLI finds the nearest board above the current directory
status: todo
priority: medium
tags:
  - cli
  - dx
  - decision
created: '2026-09-26T19:44:04.679Z'
updated: '2026-09-27T19:05:07.710Z'
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
