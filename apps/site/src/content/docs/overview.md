---
title: ShipBench Overview
description: Learn how the ShipBench project files, the ShipBench CLI, and the local board work together.
group: Getting Started
order: 1
updated: 2026-09-27
---

ShipBench keeps a project's tasks as Markdown files in the project's own repository. These are the pieces.

- **The project files.** A `.shipbench/` directory with a config file and one Markdown file per task. The format is the system; everything else reads and writes it, and it works on its own. See [ShipBench Project Files](/docs/convention-spec/).
- **The ShipBench CLI.** Creates, lists, searches, moves, and checks tasks from a terminal or an agent. It also opens the local board, either in the browser or in the terminal. See the [CLI reference](/docs/cli-reference/).

:::harbor
**ShipBench Harbor** is an optional hosted client for developing ideas before code exists and viewing task boards from public GitHub repositories, read-only. Harbor never stores tasks. They stay in their repositories, and everything else works without it.
:::

Coding agents use the same files and the same CLI. `shipbench init` writes `.shipbench/AGENTS.md` with instructions for them, and you can change it like any other file in the repository.

## Start here

New to ShipBench? Read these in order:

1. [Why ShipBench](/docs/why/): where it came from and what it does differently.
2. [Quickstart](/docs/quickstart/): install the CLI, set up a repository, create a task, and open the board.
3. [Resuming a Project](/docs/resuming-a-project/): come back after a break, hand the next task to a fresh agent, and find out why an earlier decision was made.
4. [Workflows](/docs/workflows/): pick a process, from working alone on `main` to running agents in parallel worktrees, and copy the conventions your agents need.

## Reference

- [ShipBench Project Files](/docs/convention-spec/): the `.shipbench/` directory in full, covering the task format, dependencies, updates, ordering, and archives.
- [Tracing a Decision](/docs/decision-trail/): link related tasks and record decisions so you can find out later why something was built.
- [ShipBench CLI Reference](/docs/cli-reference/): every command, flag, and JSON payload, with query patterns for agents.

:::harbor
- [ShipBench Harbor](/docs/harbor/): develop ideas before a repository exists, connect projects, and view their boards read-only.
:::
